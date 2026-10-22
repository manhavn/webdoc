use axum::extract::State;
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, DateTime, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiJson};
use crate::models::SiteSettings;
use crate::routes::{load_layout, load_site};
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactInput {
    pub name: String,
    pub email: String,
    #[serde(default)]
    pub phone: Option<String>,
    pub message: String,
}

pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

pub async fn journals(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    let docs = state
        .db
        .collection::<Document>("journals")
        .find(doc! {})
        .sort(doc! { "order": 1, "name": 1 })
        .await?
        .try_collect::<Vec<_>>()
        .await?;

    let items = docs
        .into_iter()
        .map(|document| {
            json!({
                "id": document.get_object_id("_id").map(|id| id.to_hex()).unwrap_or_default(),
                "name": document.get_str("name").unwrap_or_default(),
                "org": document.get_str("org").unwrap_or_default(),
                "logo": document.get_str("logo").unwrap_or_default(),
                "url": document.get_str("url").unwrap_or_default(),
                "order": document.get("order").map(crate::routes::bson_to_i32).unwrap_or_default(),
            })
        })
        .collect::<Vec<_>>();

    Ok(Json(Value::Array(items)))
}

pub async fn layout(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
    Ok(Json(load_layout(&state.db).await?))
}

pub async fn site(State(state): State<AppState>) -> Result<Json<SiteSettings>, ApiError> {
    Ok(Json(load_site(&state.db).await?))
}

pub async fn contact(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<ContactInput>,
) -> Result<Json<Value>, ApiError> {
    let name = input.name.trim();
    let email = input.email.trim();
    let message = input.message.trim();

    if name.is_empty() {
        return Err(ApiError::bad_request("Vui lòng nhập họ tên."));
    }
    if name.chars().count() > 200 {
        return Err(ApiError::bad_request("Họ tên quá dài."));
    }
    let valid_email = email
        .split_once('@')
        .map(|(local, domain)| {
            !local.is_empty() && domain.contains('.') && !domain.starts_with('.')
        })
        .unwrap_or(false);
    if !valid_email || email.chars().count() > 320 {
        return Err(ApiError::bad_request("Email không hợp lệ."));
    }
    if message.is_empty() {
        return Err(ApiError::bad_request("Vui lòng nhập nội dung liên hệ."));
    }
    if message.chars().count() > 5000 {
        return Err(ApiError::bad_request("Nội dung liên hệ quá dài."));
    }

    let phone = input
        .phone
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
        .to_string();

    let document = doc! {
        "name": name,
        "email": email,
        "phone": phone,
        "message": message,
        "read": false,
        "createdAt": DateTime::now(),
    };
    state
        .db
        .collection::<Document>("contacts")
        .insert_one(document)
        .await?;

    Ok(Json(json!({ "ok": true })))
}
