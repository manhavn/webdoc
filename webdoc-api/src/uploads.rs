use std::path::PathBuf;
use std::path::{Component, Path as FsPath};

use axum::body::Body;
use axum::extract::{FromRequest, Multipart, Path, Request, State};
use axum::http::header::{
    HeaderMap, HeaderValue, CACHE_CONTROL, CONTENT_TYPE, ETAG, X_CONTENT_TYPE_OPTIONS,
};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::auth::CurrentAdmin;
use crate::error::ApiError;
use crate::http_cache;
use crate::static_assets::{metadata_etag, mime_for};
use crate::AppState;

const MAX_UPLOAD_BYTES: usize = 5 * 1024 * 1024;

/// Multipart extractor with a JSON error response.
pub struct ApiMultipart(pub Multipart);

impl<S> FromRequest<S> for ApiMultipart
where
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        Multipart::from_request(req, state)
            .await
            .map(ApiMultipart)
            .map_err(|_| ApiError::bad_request("Dữ liệu tải lên không hợp lệ."))
    }
}

pub async fn upload(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiMultipart(mut multipart): ApiMultipart,
) -> Result<Json<Value>, ApiError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| ApiError::bad_request("Không thể đọc dữ liệu tải lên."))?
    {
        if field.name() != Some("file") {
            continue;
        }

        let content_type = field.content_type().map(str::to_string);
        let file_name = field.file_name().map(str::to_string);
        let extension = match extension_for(content_type.as_deref(), file_name.as_deref()) {
            Some(extension) => extension,
            None => {
                return Err(ApiError::bad_request(
                    "Chỉ chấp nhận ảnh PNG, JPEG, WEBP, GIF hoặc SVG.",
                ))
            }
        };

        let bytes = field
            .bytes()
            .await
            .map_err(|_| ApiError::bad_request("Không thể đọc dữ liệu tải lên."))?;
        if bytes.is_empty() {
            return Err(ApiError::bad_request("Tệp tải lên rỗng."));
        }
        if bytes.len() > MAX_UPLOAD_BYTES {
            return Err(ApiError::bad_request(
                "Kích thước tệp vượt quá giới hạn 5MB.",
            ));
        }

        let file_name = format!("{}.{}", Uuid::new_v4().simple(), extension);
        let path = state.config.upload_dir.join(&file_name);
        tokio::fs::write(&path, &bytes).await.map_err(|err| {
            tracing::error!(error = %err, path = %path.display(), "Failed to store upload");
            ApiError::internal("Không thể lưu tệp tải lên.")
        })?;

        return Ok(Json(json!({ "url": format!("/uploads/{file_name}") })));
    }

    Err(ApiError::bad_request(
        "Thiếu trường \"file\" trong dữ liệu tải lên.",
    ))
}

fn extension_for(content_type: Option<&str>, file_name: Option<&str>) -> Option<&'static str> {
    if let Some(content_type) = content_type {
        let mime = content_type
            .split(';')
            .next()
            .unwrap_or_default()
            .trim()
            .to_ascii_lowercase();
        let extension = match mime.as_str() {
            "image/png" => Some("png"),
            "image/jpeg" | "image/jpg" => Some("jpg"),
            "image/webp" => Some("webp"),
            "image/gif" => Some("gif"),
            "image/svg+xml" => Some("svg"),
            _ => None,
        };
        if extension.is_some() {
            return extension;
        }
    }

    // Fall back to the filename when the browser sends application/octet-stream.
    let extension = file_name?.rsplit_once('.')?.1.to_ascii_lowercase();
    match extension.as_str() {
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "webp" => Some("webp"),
        "gif" => Some("gif"),
        "svg" => Some("svg"),
        _ => None,
    }
}

/// Extract upload filenames referenced by `/uploads/<name>` in an HTML/string.
pub fn extract_upload_files(content: &str) -> std::collections::HashSet<String> {
    let re = regex::Regex::new(r"/uploads/([A-Za-z0-9._-]+)").expect("valid upload regex");
    re.captures_iter(content)
        .filter_map(|capture| capture.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

fn collect_bson_uploads(value: &mongodb::bson::Bson, out: &mut std::collections::HashSet<String>) {
    use mongodb::bson::Bson;
    match value {
        Bson::String(text) => out.extend(extract_upload_files(text)),
        Bson::Document(document) => {
            for value in document.values() {
                collect_bson_uploads(value, out);
            }
        }
        Bson::Array(items) => {
            for item in items {
                collect_bson_uploads(item, out);
            }
        }
        _ => {}
    }
}

/// Collect all upload filenames referenced by any content-bearing collection.
async fn referenced_upload_files(db: &mongodb::Database) -> std::collections::HashSet<String> {
    use futures_util::TryStreamExt;
    use mongodb::bson::{doc, Document};

    let mut referenced = std::collections::HashSet::new();
    for collection in ["docs", "pages", "journals", "layout", "settings"] {
        let mut cursor = match db.collection::<Document>(collection).find(doc! {}).await {
            Ok(cursor) => cursor,
            Err(error) => {
                tracing::warn!(collection, error = %error, "Cannot scan uploads");
                continue;
            }
        };
        while let Ok(Some(document)) = cursor.try_next().await {
            collect_bson_uploads(&mongodb::bson::Bson::Document(document), &mut referenced);
        }
    }
    referenced
}

/// Delete the given uploaded files unless they are still referenced anywhere.
/// Used when content changes/removes images or a docs node is deleted.
pub async fn delete_unreferenced_uploads(
    db: &mongodb::Database,
    upload_dir: &std::path::Path,
    candidates: &std::collections::HashSet<String>,
) {
    if candidates.is_empty() {
        return;
    }
    let referenced = referenced_upload_files(db).await;
    for file_name in candidates {
        if referenced.contains(file_name) {
            continue;
        }
        let path = upload_dir.join(file_name);
        match tokio::fs::remove_file(&path).await {
            Ok(()) => tracing::info!(file = %file_name, "Removed unused upload"),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => {
                tracing::warn!(file = %file_name, error = %error, "Cannot remove unused upload");
            }
        }
    }
}

/// Remove every file in the upload directory that is not referenced by any
/// content-bearing collection. Runs once at startup and after content edits.
pub async fn cleanup_all_orphan_uploads(db: &mongodb::Database, upload_dir: &std::path::Path) {
    let mut entries = match tokio::fs::read_dir(upload_dir).await {
        Ok(entries) => entries,
        Err(_) => return,
    };
    let mut candidates = std::collections::HashSet::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let Ok(file_type) = entry.file_type().await else {
            continue;
        };
        if !file_type.is_file() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        candidates.insert(name);
    }
    delete_unreferenced_uploads(db, upload_dir, &candidates).await;
}

/// Serve `/uploads/<path>` with a metadata ETag and a one-day public cache.
///
/// Only regular files inside the resolved upload directory are reachable;
/// absolute paths, `..` components and backslashes are rejected.
pub async fn serve(
    State(state): State<AppState>,
    Path(relative): Path<String>,
    headers: HeaderMap,
) -> Response {
    let Some(relative_path) = safe_relative_path(&relative) else {
        return not_found();
    };
    if relative_path.extension().is_none() {
        return not_found();
    }

    let full_path = state.config.upload_dir.join(&relative_path);
    let Ok(metadata) = tokio::fs::metadata(&full_path).await else {
        return not_found();
    };
    if !metadata.is_file() {
        return not_found();
    }

    let etag = metadata_etag(&metadata);
    let cache_control = HeaderValue::from_static("public, max-age=86400");

    let mut response = if http_cache::if_none_match(&headers, &etag) {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::NOT_MODIFIED;
        response
    } else {
        let Ok(body) = tokio::fs::read(&full_path).await else {
            return not_found();
        };
        let mut response = Response::new(Body::from(body));
        response
            .headers_mut()
            .insert(CONTENT_TYPE, HeaderValue::from_static(mime_for(&relative)));
        response
    };

    let response_headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&etag) {
        response_headers.insert(ETAG, value);
    }
    response_headers.insert(CACHE_CONTROL, cache_control);
    response_headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    response
}

fn safe_relative_path(relative: &str) -> Option<PathBuf> {
    if relative.is_empty() || relative.contains('\\') {
        return None;
    }
    let path = FsPath::new(relative);
    if path.is_absolute() {
        return None;
    }
    if !path
        .components()
        .all(|component| matches!(component, Component::Normal(_)))
    {
        return None;
    }
    Some(path.to_path_buf())
}

fn not_found() -> Response {
    let mut response = (StatusCode::NOT_FOUND, "Not found").into_response();
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}
