//! Global appearance/theme configuration and the editable homepage.
//!
//! The configuration is stored as one `settings` document with
//! `{ "key": "appearance", … }`. Every read is merged with
//! `seed_data/appearance.json`, so a document written by an older version (or
//! a partial admin payload) never exposes missing keys to the site.

use std::collections::HashSet;

use axum::extract::State;
use axum::Json;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;
use serde_json::{json, Map, Value};

use crate::auth::CurrentAdmin;
use crate::bson_json::{document_to_json, json_to_bson};
use crate::error::{ApiError, ApiJson};
use crate::uploads;
use crate::AppState;

const APPEARANCE_JSON: &str = include_str!("../seed_data/appearance.json");
const HOMEPAGE_DEFAULT: &str = include_str!("../seed_data/homepage.html");

/// Maximum accepted `PUT /admin/appearance` payload (serialized JSON).
pub const MAX_APPEARANCE_BYTES: usize = 256 * 1024;

/// Bundled default appearance. The file is validated by unit tests and by the
/// first-boot seed, so a malformed file fails loudly there instead of silently
/// serving an empty theme.
pub fn default_appearance() -> Value {
    let mut value = serde_json::from_str(APPEARANCE_JSON)
        .expect("src/seed_data/appearance.json is valid JSON and matches the schema");
    ensure_homepage(&mut value);
    value
}

/// Ensure the reserved `home` page exists and has HTML content. The built-in
/// React homepage is captured in `seed_data/homepage.html` and stored in the
/// database. Custom pages are not supported, so every other entry is dropped.
pub fn ensure_homepage(value: &mut Value) {
    let Some(pages) = value.get_mut("pages").and_then(Value::as_array_mut) else {
        return;
    };
    pages.retain(|page| page.get("slug").and_then(Value::as_str) == Some("home"));
    let default_titles = json!({ "en": "Homepage", "vi": "Trang chủ" });
    if let Some(home) = pages
        .iter_mut()
        .find(|page| page.get("slug").and_then(Value::as_str) == Some("home"))
    {
        let empty = home
            .get("content")
            .and_then(Value::as_str)
            .map(str::trim)
            .is_none_or(str::is_empty);
        if empty {
            if let Some(object) = home.as_object_mut() {
                object.insert(
                    "content".to_string(),
                    Value::String(HOMEPAGE_DEFAULT.to_string()),
                );
            }
        }
        if let Some(object) = home.as_object_mut() {
            object
                .entry("titles".to_string())
                .or_insert(default_titles.clone());
            object
                .entry("title".to_string())
                .or_insert_with(|| Value::String("Homepage".to_string()));
            object
                .entry("titleVi".to_string())
                .or_insert_with(|| Value::String("Trang chủ".to_string()));
        }
        return;
    }
    pages.insert(
        0,
        json!({
            "slug": "home",
            "title": "Homepage",
            "titleVi": "Trang chủ",
            "titles": default_titles,
            "content": HOMEPAGE_DEFAULT,
        }),
    );
}

/// Validate a supplied appearance object and merge it with the defaults.
///
/// Objects are merged recursively, arrays replace the default array, and any
/// unknown key is dropped. Missing keys keep their default value; a supplied
/// value of the wrong JSON type is rejected with a 400 instead of being
/// silently ignored.
pub fn normalize_appearance(input: &Value) -> Result<Value, String> {
    let input = input
        .as_object()
        .ok_or_else(|| "Appearance phải là một object.".to_string())?;
    let defaults = default_appearance();
    let defaults = defaults
        .as_object()
        .expect("default appearance is an object");
    let mut merged = merge_fields(defaults, input, "appearance")?;
    let header_input = input
        .get("header")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    let cta_labels = label_map(
        &header_input,
        "ctaLabels",
        "ctaLabel",
        "ctaLabelVi",
        "appearance.header",
    )?;
    if let Some(header) = merged.get_mut("header").and_then(Value::as_object_mut) {
        header.insert("ctaLabels".to_string(), cta_labels);
    }
    let mut merged = Value::Object(merged);
    ensure_homepage(&mut merged);
    Ok(merged)
}

/// Build a locale-keyed label map from `labels` plus the legacy EN/VI fields.
fn label_map(
    object: &Map<String, Value>,
    labels_key: &str,
    legacy_en: &str,
    legacy_vi: &str,
    path: &str,
) -> Result<Value, String> {
    let mut labels = Map::new();
    if let Some(value) = object.get(labels_key) {
        let fields = value
            .as_object()
            .ok_or_else(|| format!("{path}.{labels_key} phải là một object."))?;
        for (code, text) in fields {
            let text = text
                .as_str()
                .ok_or_else(|| format!("{path}.{labels_key}.{code} phải là chuỗi."))?;
            labels.insert(code.clone(), Value::String(text.to_string()));
        }
    }
    for (code, key) in [("en", legacy_en), ("vi", legacy_vi)] {
        if !labels.contains_key(code) {
            if let Some(Value::String(text)) = object.get(key) {
                if !text.is_empty() {
                    labels.insert(code.to_string(), Value::String(text.clone()));
                }
            }
        }
    }
    Ok(Value::Object(labels))
}

fn merge_fields(
    defaults: &Map<String, Value>,
    input: &Map<String, Value>,
    path: &str,
) -> Result<Map<String, Value>, String> {
    let mut merged = Map::with_capacity(defaults.len());
    for (key, default) in defaults {
        let value = match input.get(key) {
            Some(value) => merge_value(default, value, &format!("{path}.{key}"))?,
            None => default.clone(),
        };
        merged.insert(key.clone(), value);
    }
    Ok(merged)
}

fn merge_value(default: &Value, input: &Value, path: &str) -> Result<Value, String> {
    match default {
        Value::Object(default_fields) => {
            let input_fields = input
                .as_object()
                .ok_or_else(|| format!("{path} phải là một object."))?;
            Ok(Value::Object(merge_fields(
                default_fields,
                input_fields,
                path,
            )?))
        }
        Value::Array(_) => normalize_array(path, input),
        Value::String(_) => input
            .as_str()
            .map(|text| Value::String(text.to_string()))
            .ok_or_else(|| format!("{path} phải là chuỗi.")),
        Value::Number(_) => {
            if input.is_number() {
                Ok(input.clone())
            } else {
                Err(format!("{path} phải là số."))
            }
        }
        Value::Bool(_) => input
            .as_bool()
            .map(Value::Bool)
            .ok_or_else(|| format!("{path} phải là true hoặc false.")),
        _ => Ok(default.clone()),
    }
}

fn normalize_array(path: &str, input: &Value) -> Result<Value, String> {
    let items = input
        .as_array()
        .ok_or_else(|| format!("{path} phải là một mảng."))?;

    let normalized = match path {
        "appearance.navigation" => items
            .iter()
            .enumerate()
            .map(|(index, item)| normalize_navigation_item(item, index, path))
            .collect::<Result<Vec<_>, _>>()?,
        "appearance.footer.links" | "appearance.footer.products" => items
            .iter()
            .enumerate()
            .map(|(index, item)| normalize_link(item, index, path))
            .collect::<Result<Vec<_>, _>>()?,
        "appearance.pages" => items
            .iter()
            .enumerate()
            .map(|(index, item)| normalize_page(item, index, path))
            .collect::<Result<Vec<_>, _>>()?,
        _ => items.clone(),
    };

    Ok(Value::Array(normalized))
}

fn item_object<'a>(
    item: &'a Value,
    index: usize,
    path: &str,
) -> Result<&'a Map<String, Value>, String> {
    item.as_object()
        .ok_or_else(|| format!("{path}[{index}] phải là một object."))
}

/// Read a string field; a missing field becomes empty, a wrong type is rejected.
fn string_field(object: &Map<String, Value>, key: &str, path: &str) -> Result<String, String> {
    match object.get(key) {
        None => Ok(String::new()),
        Some(Value::String(text)) => Ok(text.clone()),
        Some(_) => Err(format!("{path}.{key} phải là chuỗi.")),
    }
}

fn normalize_link(item: &Value, index: usize, path: &str) -> Result<Value, String> {
    let item_path = format!("{path}[{index}]");
    let object = item_object(item, index, path)?;
    Ok(json!({
        "label": string_field(object, "label", &item_path)?,
        "labelVi": string_field(object, "labelVi", &item_path)?,
        "labels": label_map(object, "labels", "label", "labelVi", &item_path)?,
        "href": string_field(object, "href", &item_path)?,
    }))
}

fn normalize_nav_link(item: &Value, index: usize, path: &str) -> Result<Value, String> {
    let item_path = format!("{path}[{index}]");
    let object = item_object(item, index, path)?;
    let links = match object.get("links") {
        None => Vec::new(),
        Some(Value::Array(items)) => items
            .iter()
            .enumerate()
            .map(|(index, item)| normalize_nav_link(item, index, &format!("{item_path}.links")))
            .collect::<Result<Vec<_>, _>>()?,
        Some(_) => return Err(format!("{item_path}.links phải là một mảng.")),
    };
    Ok(json!({
        "label": string_field(object, "label", &item_path)?,
        "labelVi": string_field(object, "labelVi", &item_path)?,
        "labels": label_map(object, "labels", "label", "labelVi", &item_path)?,
        "href": string_field(object, "href", &item_path)?,
        "links": links,
    }))
}

fn normalize_navigation_item(item: &Value, index: usize, path: &str) -> Result<Value, String> {
    normalize_nav_link(item, index, path)
}

fn normalize_page(item: &Value, index: usize, path: &str) -> Result<Value, String> {
    let item_path = format!("{path}[{index}]");
    let object = item_object(item, index, path)?;
    let slug = string_field(object, "slug", &item_path)?;
    if slug.trim().is_empty() {
        return Err(format!("{item_path}.slug không được để trống."));
    }
    Ok(json!({
        "slug": slug,
        "title": string_field(object, "title", &item_path)?,
        "titleVi": string_field(object, "titleVi", &item_path)?,
        "titles": label_map(object, "titles", "title", "titleVi", &item_path)?,
        "content": string_field(object, "content", &item_path)?,
    }))
}

/// Load the stored appearance merged with the bundled defaults.
pub async fn load_appearance(db: &Database) -> Result<Value, ApiError> {
    let stored = db
        .collection::<Document>("settings")
        .find_one(doc! { "key": "appearance" })
        .await?;

    let Some(mut document) = stored else {
        return Ok(default_appearance());
    };
    document.remove("_id");
    document.remove("key");

    let value = document_to_json(&document);
    Ok(normalize_appearance(&value).unwrap_or_else(|error| {
        tracing::warn!(%error, "Stored appearance is invalid; serving defaults");
        default_appearance()
    }))
}

/// Validate, normalize and persist the complete appearance document.
pub async fn save_appearance(db: &Database, input: &Value) -> Result<Value, ApiError> {
    let normalized = normalize_appearance(input).map_err(ApiError::bad_request)?;
    let Bson::Document(mut document) = json_to_bson(normalized.clone()) else {
        return Err(ApiError::bad_request("Appearance phải là một object."));
    };
    document.insert("key", "appearance");

    db.collection::<Document>("settings")
        .update_one(doc! { "key": "appearance" }, doc! { "$set": document })
        .upsert(true)
        .await?;

    Ok(normalized)
}

/// Upload filenames referenced anywhere inside an appearance document
/// (background image, header/footer images, editable page HTML, …).
pub fn appearance_upload_files(value: &Value) -> HashSet<String> {
    let mut files = HashSet::new();
    collect_upload_files(value, &mut files);
    files
}

fn collect_upload_files(value: &Value, files: &mut HashSet<String>) {
    match value {
        Value::String(text) => files.extend(uploads::extract_upload_files(text)),
        Value::Object(object) => {
            for value in object.values() {
                collect_upload_files(value, files);
            }
        }
        Value::Array(items) => {
            for item in items {
                collect_upload_files(item, files);
            }
        }
        _ => {}
    }
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

/// GET /settings/appearance
pub async fn public_get(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    Ok(Json(load_appearance(&state.db).await?))
}

/// GET /admin/appearance
pub async fn admin_get(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(load_appearance(&state.db).await?))
}

/// PUT /admin/appearance — replaces the complete appearance document.
pub async fn admin_put(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiJson(body): ApiJson<Value>,
) -> Result<Json<Value>, ApiError> {
    let size = serde_json::to_vec(&body)
        .map_err(|error| {
            tracing::warn!(%error, "Cannot measure appearance payload");
            ApiError::bad_request("Dữ liệu appearance không hợp lệ.")
        })?
        .len();
    if size > MAX_APPEARANCE_BYTES {
        return Err(ApiError::bad_request(
            "Cấu hình appearance vượt quá giới hạn 256KB.",
        ));
    }

    let old_files = appearance_upload_files(&load_appearance(&state.db).await?);
    let saved = save_appearance(&state.db, &body).await?;
    let new_files = appearance_upload_files(&saved);
    let removed: HashSet<String> = old_files.difference(&new_files).cloned().collect();
    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed).await;

    Ok(Json(saved))
}

/// POST /admin/appearance/homepage/reset — write the bundled homepage HTML
/// back into the reserved `home` page and persist it immediately.
pub async fn admin_reset_homepage(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    let mut appearance = load_appearance(&state.db).await?;
    if let Some(pages) = appearance.get_mut("pages").and_then(Value::as_array_mut) {
        pages.retain(|page| page.get("slug").and_then(Value::as_str) != Some("home"));
    }
    ensure_homepage(&mut appearance);
    let saved = save_appearance(&state.db, &appearance).await?;
    Ok(Json(saved))
}

/// Persist the default homepage once, including upgrades from databases that
/// predate the homepage HTML page.
pub async fn ensure_homepage_persisted(db: &Database) -> Result<(), ApiError> {
    let stored = db
        .collection::<Document>("settings")
        .find_one(doc! { "key": "appearance" })
        .await?;
    let Some(mut document) = stored else {
        let default = default_appearance();
        save_appearance(db, &default).await?;
        return Ok(());
    };
    document.remove("_id");
    document.remove("key");
    let raw = document_to_json(&document);
    let needs_save = raw
        .get("pages")
        .and_then(Value::as_array)
        .and_then(|pages| {
            pages
                .iter()
                .find(|page| page.get("slug").and_then(Value::as_str) == Some("home"))
        })
        .and_then(|page| page.get("content").and_then(Value::as_str))
        .map(str::trim)
        .is_none_or(str::is_empty);
    if needs_save {
        let current = normalize_appearance(&raw).map_err(ApiError::bad_request)?;
        save_appearance(db, &current).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_defaults_are_complete() {
        let defaults = default_appearance();
        let normalized = normalize_appearance(&json!({})).unwrap();
        assert_eq!(normalized, defaults);

        for key in ["colors", "fonts", "background", "header", "footer"] {
            assert!(defaults.get(key).is_some_and(Value::is_object), "{key}");
        }
        assert!(defaults["navigation"].as_array().unwrap().is_empty());
        assert_eq!(defaults["pages"].as_array().unwrap().len(), 1);
        assert_eq!(defaults["pages"][0]["slug"], "home");
        assert_eq!(defaults["colors"]["primary"], "#0f766e");
        assert_eq!(defaults["colors"]["footerText"], "#d1fae5");
        assert_eq!(defaults["footer"]["background"], "");
    }

    #[test]
    fn partial_input_merges_with_defaults() {
        let value = normalize_appearance(&json!({
            "colors": { "primary": "#123456" },
            "header": { "show": false },
            "unknown": true,
        }))
        .unwrap();

        assert_eq!(value["colors"]["primary"], "#123456");
        assert_eq!(value["colors"]["primaryDark"], "#115e59");
        assert_eq!(value["header"]["show"], false);
        assert_eq!(value["header"]["sticky"], true);
        assert!(value.get("unknown").is_none());
    }

    #[test]
    fn arrays_are_normalized_and_wrong_types_are_rejected() {
        let value = normalize_appearance(&json!({
            "footer": { "links": [{ "label": "Docs" }] },
            "navigation": [{
                "label": "Home",
                "links": [{ "href": "/docs", "labelVi": "Tài liệu", "extra": 1 }]
            }],
            "pages": [{ "slug": "contact", "title": "About", "content": "<p>Hi</p>" }],
        }))
        .unwrap();

        assert_eq!(value["footer"]["links"][0]["label"], "Docs");
        assert_eq!(value["footer"]["links"][0]["href"], "");
        assert_eq!(value["navigation"][0]["links"][0]["href"], "/docs");
        assert!(value["navigation"][0]["links"][0].get("extra").is_none());
        assert_eq!(value["pages"].as_array().unwrap().len(), 1);
        assert_eq!(value["pages"][0]["slug"], "home");

        assert!(normalize_appearance(&json!({ "colors": [] })).is_err());
        assert!(normalize_appearance(&json!({ "header": { "show": "yes" } })).is_err());
        assert!(normalize_appearance(&json!({ "pages": [{ "slug": "" }] })).is_err());
        assert!(normalize_appearance(&json!([])).is_err());
    }

    #[test]
    fn navigation_children_can_be_nested() {
        let value = normalize_appearance(&json!({
            "navigation": [{
                "label": "Docs",
                "href": "/docs",
                "links": [{
                    "label": "Admin",
                    "href": "/admin",
                    "links": [{
                        "label": "DOI",
                        "href": "/doi",
                        "links": [{ "label": "Assign", "href": "/assign" }]
                    }]
                }]
            }]
        }))
        .unwrap();

        let assign = &value["navigation"][0]["links"][0]["links"][0]["links"][0];
        assert_eq!(assign["href"], "/assign");
        assert_eq!(assign["links"].as_array().unwrap().len(), 0);
        assert!(normalize_appearance(&json!({
            "navigation": [{ "links": [{ "links": "invalid" }] }]
        }))
        .is_err());
    }

    #[test]
    fn upload_references_are_collected_recursively() {
        let value = json!({
            "background": { "image": "/uploads/bg.png" },
            "header": { "background": "/uploads/header.png" },
            "pages": [{ "content": "<img src=\"/uploads/page.webp\">" }],
        });
        let files = appearance_upload_files(&value);
        assert!(files.contains("bg.png"));
        assert!(files.contains("header.png"));
        assert!(files.contains("page.webp"));
        assert_eq!(files.len(), 3);
    }

    #[test]
    fn default_payload_fits_the_limit() {
        assert!(serde_json::to_vec(&default_appearance()).unwrap().len() < MAX_APPEARANCE_BYTES);
    }
}
