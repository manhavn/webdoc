//! Whole-installation backup export and import.
//!
//! An archive is a plain ZIP with the following layout:
//!
//! ```text
//! manifest.json          {"format":"webdoc-backup","version":1,"exportedAt":…,
//!                         "collections":[{"name":…,"count":…}],"uploads":[names]}
//! data/<collection>.json MongoDB Extended JSON array, one entry per collection
//! uploads/<name>         every regular file in UPLOAD_DIR (hidden entries skipped)
//! ```
//!
//! Data files use MongoDB Extended JSON (relaxed serialization, canonical dates)
//! so BSON types such as `ObjectId` and `DateTime` survive the round trip.
//! Import replaces whole collections but keeps indexes, and never touches
//! collections that are absent from the archive.

use std::collections::HashSet;
use std::io::{Read, Seek, Write};
use std::path::{Path, PathBuf};

use axum::body::Body;
use axum::extract::State;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_LENGTH, CONTENT_TYPE};
use axum::http::HeaderValue;
use axum::response::Response;
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::AsyncWriteExt;
use tokio_util::io::ReaderStream;
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use crate::auth::CurrentAdmin;
use crate::error::ApiError;
use crate::uploads::ApiMultipart;
use crate::AppState;

const BACKUP_FORMAT: &str = "webdoc-backup";
const BACKUP_VERSION: u32 = 1;
const MANIFEST_NAME: &str = "manifest.json";

const MAX_ENTRIES: usize = 5000;
const MAX_TOTAL_BYTES: u64 = 512 * 1024 * 1024;
const MAX_ENTRY_BYTES: u64 = 200 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 8 * 1024 * 1024;

/// Request body limit applied to the import route only.
pub const MAX_IMPORT_BODY_BYTES: usize = 512 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ManifestCount {
    name: String,
    count: i64,
}

#[derive(Serialize)]
struct ExportManifest<'a> {
    format: &'a str,
    version: u32,
    #[serde(rename = "exportedAt")]
    exported_at: String,
    collections: Vec<ManifestCount>,
    uploads: Vec<String>,
}

#[derive(Deserialize)]
struct ManifestCountInput {
    #[serde(default)]
    name: String,
    #[serde(default)]
    #[allow(dead_code)]
    count: i64,
}

#[derive(Deserialize)]
struct ImportManifest {
    #[serde(default)]
    format: Option<String>,
    #[serde(default)]
    version: Option<u32>,
    #[serde(default)]
    #[allow(dead_code)]
    #[serde(rename = "exportedAt")]
    exported_at: Option<String>,
    #[serde(default)]
    collections: Vec<ManifestCountInput>,
    #[serde(default)]
    #[allow(dead_code)]
    uploads: Vec<String>,
}

// ---------------------------------------------------------------------------
// GET /admin/export
// ---------------------------------------------------------------------------

pub async fn export(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Response, ApiError> {
    let exported_at = mongodb::bson::DateTime::now()
        .try_to_rfc3339_string()
        .unwrap_or_default();

    let mut names = state.db.list_collection_names().await?;
    names.sort();

    let mut collections: Vec<(String, i64)> = Vec::with_capacity(names.len());
    for name in names {
        if name.starts_with("system.") {
            continue;
        }
        validate_collection_name(&name)?;
        let count = state
            .db
            .collection::<Document>(&name)
            .count_documents(doc! {})
            .await?;
        collections.push((name, count as i64));
    }

    let uploads = collect_upload_files(&state.config.upload_dir)?;
    let upload_names: Vec<String> = uploads.iter().map(|(name, _)| name.clone()).collect();

    let manifest = ExportManifest {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exported_at: exported_at.clone(),
        collections: collections
            .iter()
            .map(|(name, count)| ManifestCount {
                name: name.clone(),
                count: *count,
            })
            .collect(),
        uploads: upload_names,
    };
    let manifest_bytes = serde_json::to_vec(&manifest)
        .map_err(|err| internal_error(err, "Failed to serialize backup manifest"))?;

    let filename = backup_filename(&exported_at);
    let temp = TempFileGuard::new(&format!("webdoc-backup-{}.zip", Uuid::new_v4()));

    write_backup_zip(
        &state.db,
        temp.path(),
        &manifest_bytes,
        &collections,
        &uploads,
    )
    .await?;

    let file = tokio::fs::File::open(temp.path())
        .await
        .map_err(|err| internal_error(err, "Failed to open backup archive"))?;
    let length = file.metadata().await.ok().map(|meta| meta.len());

    // The open handle keeps the data readable after the directory entry is gone.
    let _ = tokio::fs::remove_file(temp.path()).await;

    let mut response = Response::new(Body::from_stream(ReaderStream::new(file)));
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/zip"));
    headers.insert(
        CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
            .map_err(|err| internal_error(err, "Invalid backup filename"))?,
    );
    if let Some(length) = length {
        headers.insert(CONTENT_LENGTH, HeaderValue::from(length));
    }
    Ok(response)
}

async fn write_backup_zip(
    db: &Database,
    path: &Path,
    manifest_bytes: &[u8],
    collections: &[(String, i64)],
    uploads: &[(String, PathBuf)],
) -> Result<(), ApiError> {
    let file = std::fs::File::create(path)
        .map_err(|err| internal_error(err, "Failed to create backup archive"))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    zip.start_file(MANIFEST_NAME, options)
        .map_err(|err| internal_error(err, "Failed to write backup manifest"))?;
    zip.write_all(manifest_bytes)
        .map_err(|err| internal_error(err, "Failed to write backup manifest"))?;

    for (name, _) in collections {
        let documents: Vec<Document> = db
            .collection::<Document>(name)
            .find(doc! {})
            .await?
            .try_collect()
            .await?;

        zip.start_file(format!("data/{name}.json"), options)
            .map_err(|err| internal_error(err, "Failed to write backup data"))?;
        zip.write_all(b"[")
            .map_err(|err| internal_error(err, "Failed to write backup data"))?;
        for (index, document) in documents.iter().enumerate() {
            if index > 0 {
                zip.write_all(b",\n")
                    .map_err(|err| internal_error(err, "Failed to write backup data"))?;
            }
            serde_json::to_writer(&mut zip, document)
                .map_err(|err| internal_error(err, "Failed to serialize backup data"))?;
        }
        zip.write_all(b"]\n")
            .map_err(|err| internal_error(err, "Failed to write backup data"))?;
    }

    for (name, source) in uploads {
        let mut source = std::fs::File::open(source)
            .map_err(|err| internal_error(err, "Failed to read an uploaded file for the backup"))?;
        zip.start_file(format!("uploads/{name}"), options)
            .map_err(|err| internal_error(err, "Failed to write backup uploads"))?;
        std::io::copy(&mut source, &mut zip)
            .map_err(|err| internal_error(err, "Failed to write backup uploads"))?;
    }

    zip.finish()
        .map_err(|err| internal_error(err, "Failed to finalize backup archive"))?;
    Ok(())
}

/// Walk `UPLOAD_DIR` recursively and return `(relative/name, absolute path)`
/// for every regular file, skipping hidden files and directories.
fn collect_upload_files(root: &Path) -> Result<Vec<(String, PathBuf)>, ApiError> {
    let mut files = Vec::new();
    if !root.is_dir() {
        return Ok(files);
    }

    let mut pending = vec![root.to_path_buf()];
    while let Some(directory) = pending.pop() {
        let entries = std::fs::read_dir(&directory)
            .map_err(|err| internal_error(err, "Failed to read the upload directory"))?;
        for entry in entries {
            let entry =
                entry.map_err(|err| internal_error(err, "Failed to read the upload directory"))?;
            let file_name = entry.file_name();
            if file_name.to_string_lossy().starts_with('.') {
                continue;
            }
            let path = entry.path();
            let file_type = entry
                .file_type()
                .map_err(|err| internal_error(err, "Failed to inspect an uploaded file"))?;
            if file_type.is_dir() {
                pending.push(path);
            } else if file_type.is_file() {
                let relative = path.strip_prefix(root).unwrap_or(&path);
                let mut name = String::new();
                for component in relative.components() {
                    if !name.is_empty() {
                        name.push('/');
                    }
                    name.push_str(&component.as_os_str().to_string_lossy());
                }
                files.push((name, path));
            }
        }
    }

    files.sort_by(|left, right| left.0.cmp(&right.0));
    Ok(files)
}

fn backup_filename(exported_at: &str) -> String {
    let digits: String = exported_at
        .chars()
        .filter(char::is_ascii_digit)
        .take(14)
        .collect();
    if digits.len() == 14 {
        format!("webdoc-backup-{}-{}.zip", &digits[0..8], &digits[8..14])
    } else {
        "webdoc-backup.zip".to_string()
    }
}

// ---------------------------------------------------------------------------
// POST /admin/import
// ---------------------------------------------------------------------------

/// Everything that was validated and staged from the archive. All parsing
/// happens before the first destructive database or filesystem write.
struct StagedBackup {
    collections: Vec<(String, Vec<Document>)>,
    uploads: Vec<(String, PathBuf)>,
}

pub async fn import(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiMultipart(mut multipart): ApiMultipart,
) -> Result<Json<Value>, ApiError> {
    let temp = TempFileGuard::new(&format!("webdoc-import-{}.zip", Uuid::new_v4()));
    let staging = TempDirGuard::new(&format!("webdoc-import-{}", Uuid::new_v4()));

    let mut received = 0u64;
    let mut found = false;
    let mut file = tokio::fs::File::create(temp.path())
        .await
        .map_err(|err| internal_error(err, "Failed to create an import buffer"))?;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::bad_request("Không thể đọc dữ liệu tải lên."))?
    {
        if field.name() != Some("file") {
            continue;
        }
        found = true;
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|_| ApiError::bad_request("Không thể đọc dữ liệu tải lên."))?
        {
            received += chunk.len() as u64;
            if received > MAX_TOTAL_BYTES {
                return Err(ApiError::bad_request("Tệp ZIP vượt quá giới hạn 512MB."));
            }
            file.write_all(&chunk)
                .await
                .map_err(|err| internal_error(err, "Failed to store the import archive"))?;
        }
        break;
    }

    file.flush()
        .await
        .map_err(|err| internal_error(err, "Failed to store the import archive"))?;
    drop(file);

    if !found {
        return Err(ApiError::bad_request("Thiếu tệp ZIP (trường \"file\")."));
    }
    if received == 0 {
        return Err(ApiError::bad_request("Tệp ZIP rỗng."));
    }

    let zip_path = temp.path().to_path_buf();
    let staging_path = staging.path().to_path_buf();
    let staged = tokio::task::spawn_blocking(move || stage_import(&zip_path, &staging_path))
        .await
        .map_err(|err| internal_error(err, "Failed to read the import archive"))??;

    // From here on the archive is fully validated.
    let mut counts = serde_json::Map::new();
    for (name, documents) in &staged.collections {
        let collection = state.db.collection::<Document>(name);
        collection.delete_many(doc! {}).await?;
        if !documents.is_empty() {
            collection.insert_many(documents).await?;
        }
        counts.insert(name.clone(), json!(documents.len()));
    }

    clear_upload_dir(&state.config.upload_dir).await?;

    let mut imported_uploads = 0usize;
    for (relative, staged_path) in &staged.uploads {
        let mut destination = state.config.upload_dir.clone();
        for component in relative.split('/') {
            destination.push(component);
        }
        if let Some(parent) = destination.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|err| internal_error(err, "Failed to create the upload directory"))?;
        }
        tokio::fs::copy(staged_path, &destination)
            .await
            .map_err(|err| internal_error(err, "Failed to restore an uploaded file"))?;
        imported_uploads += 1;
    }

    Ok(Json(json!({
        "ok": true,
        "collections": Value::Object(counts),
        "uploads": imported_uploads,
    })))
}

/// Validate the archive structure and parse every payload without writing
/// anything outside the temporary staging directory.
fn stage_import(zip_path: &Path, staging_path: &Path) -> Result<StagedBackup, ApiError> {
    let file = std::fs::File::open(zip_path)
        .map_err(|err| internal_error(err, "Failed to open the import archive"))?;
    let mut archive = ZipArchive::new(file).map_err(|_| invalid_archive())?;

    if archive.is_empty() {
        return Err(ApiError::bad_request("Tệp ZIP rỗng."));
    }
    if archive.len() > MAX_ENTRIES {
        return Err(ApiError::bad_request(format!(
            "Tệp ZIP có quá nhiều mục (tối đa {MAX_ENTRIES})."
        )));
    }

    let mut names: Vec<String> = Vec::with_capacity(archive.len());
    let mut seen = HashSet::with_capacity(archive.len());
    let mut declared_total = 0u64;

    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|_| invalid_archive())?;
        let name = entry.name().to_string();
        validate_entry_name(&name)?;
        if entry.is_dir() {
            return Err(ApiError::bad_request(format!(
                "Mục ZIP không được là thư mục: {name}"
            )));
        }
        let size = entry.size();
        if size > MAX_ENTRY_BYTES {
            return Err(ApiError::bad_request(format!(
                "Mục ZIP vượt quá giới hạn 200MB: {name}"
            )));
        }
        declared_total = declared_total
            .checked_add(size)
            .ok_or_else(|| ApiError::bad_request("Tệp ZIP quá lớn."))?;
        if declared_total > MAX_TOTAL_BYTES {
            return Err(ApiError::bad_request(
                "Tổng dung lượng giải nén vượt quá giới hạn 512MB.",
            ));
        }
        if !seen.insert(name.clone()) {
            return Err(ApiError::bad_request(format!(
                "Tệp ZIP có mục trùng tên: {name}"
            )));
        }
        names.push(name);
    }

    if !seen.contains(MANIFEST_NAME) {
        return Err(ApiError::bad_request("Thiếu manifest.json trong tệp ZIP."));
    }

    let mut data_collections: Vec<String> = Vec::new();
    let mut upload_entries: Vec<(String, String)> = Vec::new();
    for name in &names {
        if name == MANIFEST_NAME {
            continue;
        }
        if let Some(rest) = name.strip_prefix("data/") {
            let collection = rest
                .strip_suffix(".json")
                .ok_or_else(|| ApiError::bad_request(format!("Mục ZIP không hợp lệ: {name}")))?;
            validate_collection_name(collection)?;
            data_collections.push(collection.to_string());
        } else if let Some(rest) = name.strip_prefix("uploads/") {
            validate_upload_path(rest)?;
            upload_entries.push((name.clone(), rest.to_string()));
        } else {
            return Err(ApiError::bad_request(format!(
                "Mục ZIP không xác định: {name}"
            )));
        }
    }

    let manifest_bytes = read_entry(&mut archive, MANIFEST_NAME, MAX_MANIFEST_BYTES)?;
    let manifest: ImportManifest = serde_json::from_slice(&manifest_bytes)
        .map_err(|_| ApiError::bad_request("manifest.json không hợp lệ."))?;
    if manifest.format.as_deref() != Some(BACKUP_FORMAT) {
        return Err(ApiError::bad_request(
            "manifest.json: định dạng không được hỗ trợ.",
        ));
    }
    if manifest.version != Some(BACKUP_VERSION) {
        return Err(ApiError::bad_request(
            "manifest.json: phiên bản không được hỗ trợ.",
        ));
    }

    let mut manifest_collections: Vec<String> = manifest
        .collections
        .iter()
        .map(|item| item.name.clone())
        .collect();
    manifest_collections.sort();
    manifest_collections.dedup();
    let mut sorted_data = data_collections.clone();
    sorted_data.sort();
    if manifest_collections != sorted_data {
        return Err(ApiError::bad_request(
            "manifest.json không khớp với dữ liệu trong tệp ZIP.",
        ));
    }

    let mut collections = Vec::with_capacity(data_collections.len());
    for collection in data_collections {
        let entry_name = format!("data/{collection}.json");
        let bytes = read_entry(&mut archive, &entry_name, MAX_ENTRY_BYTES)?;
        let documents: Vec<Document> = serde_json::from_slice(&bytes).map_err(|err| {
            tracing::error!(collection = %collection, error = %err, "Invalid backup document JSON");
            ApiError::bad_request(format!(
                "Dữ liệu JSON của bộ sưu tập \"{collection}\" không hợp lệ."
            ))
        })?;
        validate_document_ids(&collection, &documents)?;
        collections.push((collection, documents));
    }

    let mut uploads = Vec::with_capacity(upload_entries.len());
    let mut extracted_total = 0u64;
    for (entry_name, relative) in upload_entries {
        let mut entry = archive
            .by_name(&entry_name)
            .map_err(|_| invalid_archive())?;
        let mut destination = staging_path.to_path_buf();
        for component in relative.split('/') {
            destination.push(component);
        }
        if let Some(parent) = destination.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|err| internal_error(err, "Failed to stage an uploaded file"))?;
        }
        let mut output = std::fs::File::create(&destination)
            .map_err(|err| internal_error(err, "Failed to stage an uploaded file"))?;
        let copied = std::io::copy(&mut entry.by_ref().take(MAX_ENTRY_BYTES + 1), &mut output)
            .map_err(|_| invalid_archive())?;
        output
            .flush()
            .map_err(|err| internal_error(err, "Failed to stage an uploaded file"))?;
        if copied > MAX_ENTRY_BYTES {
            return Err(ApiError::bad_request(format!(
                "Mục ZIP vượt quá giới hạn 200MB: {entry_name}"
            )));
        }
        extracted_total = extracted_total
            .checked_add(copied)
            .ok_or_else(|| ApiError::bad_request("Tệp ZIP quá lớn."))?;
        if extracted_total > MAX_TOTAL_BYTES {
            return Err(ApiError::bad_request(
                "Tổng dung lượng giải nén vượt quá giới hạn 512MB.",
            ));
        }
        uploads.push((relative, destination));
    }

    Ok(StagedBackup {
        collections,
        uploads,
    })
}

fn read_entry<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
    limit: u64,
) -> Result<Vec<u8>, ApiError> {
    let entry = archive.by_name(name).map_err(|_| invalid_archive())?;
    let mut buffer = Vec::new();
    entry
        .take(limit + 1)
        .read_to_end(&mut buffer)
        .map_err(|_| invalid_archive())?;
    if buffer.len() as u64 > limit {
        return Err(ApiError::bad_request(format!(
            "Mục ZIP vượt quá giới hạn cho phép: {name}"
        )));
    }
    Ok(buffer)
}

fn validate_document_ids(collection: &str, documents: &[Document]) -> Result<(), ApiError> {
    let mut ids = HashSet::with_capacity(documents.len());
    for document in documents {
        if let Some(id) = document.get("_id") {
            if matches!(id, Bson::Array(_)) {
                return Err(ApiError::bad_request(format!(
                    "Bộ sưu tập \"{collection}\" chứa _id không hợp lệ."
                )));
            }
            let key = serde_json::to_string(id).unwrap_or_default();
            if !ids.insert(key) {
                return Err(ApiError::bad_request(format!(
                    "Bộ sưu tập \"{collection}\" chứa _id trùng lặp."
                )));
            }
        }
    }
    Ok(())
}

fn validate_entry_name(name: &str) -> Result<(), ApiError> {
    if name.is_empty()
        || name.starts_with('/')
        || name.contains('\\')
        || name.contains('\0')
        || name.chars().any(char::is_control)
    {
        return Err(invalid_entry(name));
    }
    for component in name.split('/') {
        if component.is_empty() || component == "." || component == ".." {
            return Err(invalid_entry(name));
        }
    }
    Ok(())
}

fn validate_upload_path(relative: &str) -> Result<(), ApiError> {
    if relative.is_empty() {
        return Err(ApiError::bad_request("Đường dẫn tệp tải lên không hợp lệ."));
    }
    for component in relative.split('/') {
        if component.is_empty()
            || component == "."
            || component == ".."
            || component.starts_with('.')
            || component.contains('\\')
            || component.contains('\0')
        {
            return Err(ApiError::bad_request("Đường dẫn tệp tải lên không hợp lệ."));
        }
    }
    Ok(())
}

fn validate_collection_name(name: &str) -> Result<(), ApiError> {
    let valid = !name.is_empty()
        && !name.starts_with("system.")
        && !name.starts_with('.')
        && !name.ends_with('.')
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains('$')
        && !name.contains('\0')
        && !name.chars().any(char::is_control);
    if !valid {
        return Err(ApiError::bad_request(format!(
            "Tên bộ sưu tập không hợp lệ: {name}"
        )));
    }
    Ok(())
}

async fn clear_upload_dir(directory: &Path) -> Result<(), ApiError> {
    let mut entries = match tokio::fs::read_dir(directory).await {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            tokio::fs::create_dir_all(directory)
                .await
                .map_err(|err| internal_error(err, "Failed to create the upload directory"))?;
            return Ok(());
        }
        Err(err) => return Err(internal_error(err, "Failed to read the upload directory")),
    };

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|err| internal_error(err, "Failed to read the upload directory"))?
    {
        if entry.file_name() == ".gitkeep" {
            continue;
        }
        let file_type = entry
            .file_type()
            .await
            .map_err(|err| internal_error(err, "Failed to inspect an uploaded file"))?;
        let path = entry.path();
        let result = if file_type.is_dir() {
            tokio::fs::remove_dir_all(&path).await
        } else {
            tokio::fs::remove_file(&path).await
        };
        result.map_err(|err| internal_error(err, "Failed to clear the upload directory"))?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Removes its file when dropped, so temporary archives never leak.
struct TempFileGuard(PathBuf);

impl TempFileGuard {
    fn new(name: &str) -> Self {
        Self(std::env::temp_dir().join(name))
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempFileGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Removes its directory recursively when dropped.
struct TempDirGuard(PathBuf);

impl TempDirGuard {
    fn new(name: &str) -> Self {
        let path = std::env::temp_dir().join(name);
        let _ = std::fs::create_dir_all(&path);
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TempDirGuard {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn invalid_archive() -> ApiError {
    ApiError::bad_request("Tệp ZIP không hợp lệ.")
}

fn invalid_entry(name: &str) -> ApiError {
    tracing::warn!(entry = %name, "Rejected backup archive entry");
    ApiError::bad_request(format!("Đường dẫn trong ZIP không hợp lệ: {name}"))
}

fn internal_error(err: impl std::fmt::Display, context: &str) -> ApiError {
    tracing::error!(error = %err, "{context}");
    ApiError::internal("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.")
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::{oid::ObjectId, DateTime};

    #[test]
    fn entry_names_reject_traversal() {
        for name in [
            "../etc/passwd",
            "uploads/../../etc/passwd",
            "/etc/passwd",
            "data/../x.json",
            "uploads\\evil.png",
            "uploads//evil.png",
            "./manifest.json",
            "data/\u{0}.json",
        ] {
            assert!(
                validate_entry_name(name).is_err(),
                "{name} should be rejected"
            );
        }

        for name in [
            "manifest.json",
            "data/docs.json",
            "uploads/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.png",
            "uploads/nested/folder/file.png",
        ] {
            assert!(
                validate_entry_name(name).is_ok(),
                "{name} should be accepted"
            );
        }
    }

    #[test]
    fn upload_paths_reject_hidden_and_traversal() {
        assert!(validate_upload_path("../evil.png").is_err());
        assert!(validate_upload_path("nested/../../evil.png").is_err());
        assert!(validate_upload_path(".gitkeep").is_err());
        assert!(validate_upload_path("nested/.hidden/file.png").is_err());
        assert!(validate_upload_path("nested/file.png").is_ok());
    }

    #[test]
    fn collection_names_reject_system_and_reserved() {
        assert!(validate_collection_name("docs").is_ok());
        assert!(validate_collection_name("journal_entries").is_ok());
        assert!(validate_collection_name("system.users").is_err());
        assert!(validate_collection_name("a/b").is_err());
        assert!(validate_collection_name("a$b").is_err());
        assert!(validate_collection_name("").is_err());
    }

    #[test]
    fn extended_json_round_trips_object_ids_and_dates() {
        let id = ObjectId::new();
        let created = DateTime::from_millis(1_700_000_000_123);
        let document = doc! {
            "_id": id,
            "createdAt": created,
            "nested": { "enabled": true, "list": [1, 2, 3] },
        };

        let serialized = serde_json::to_vec(&vec![document]).unwrap();
        let parsed: Vec<Document> = serde_json::from_slice(&serialized).unwrap();

        assert_eq!(parsed[0].get_object_id("_id").unwrap(), id);
        assert_eq!(
            parsed[0]
                .get_datetime("createdAt")
                .unwrap()
                .timestamp_millis(),
            created.timestamp_millis()
        );
        assert_eq!(
            parsed[0]
                .get_document("nested")
                .unwrap()
                .get_array("list")
                .unwrap()
                .len(),
            3
        );
    }

    #[test]
    fn backup_filename_uses_timestamp_digits() {
        assert_eq!(
            backup_filename("2026-10-22T12:34:56.789Z"),
            "webdoc-backup-20261022-123456.zip"
        );
        assert_eq!(backup_filename(""), "webdoc-backup.zip");
    }
}
