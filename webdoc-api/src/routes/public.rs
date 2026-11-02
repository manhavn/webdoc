use axum::extract::State;
use axum::Json;
use mongodb::bson::{doc, DateTime, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::error::{ApiError, ApiJson};
use crate::models::{CmsSettings, SiteSettings};
use crate::routes::{load_cms_settings, load_site};
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

pub async fn site(State(state): State<AppState>) -> Result<Json<SiteSettings>, ApiError> {
    Ok(Json(load_site(&state.db).await?))
}

pub async fn cms_settings(State(state): State<AppState>) -> Result<Json<CmsSettings>, ApiError> {
    Ok(Json(load_cms_settings(&state.db).await?))
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
