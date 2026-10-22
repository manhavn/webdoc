use axum::extract::State;
use axum::Json;
use mongodb::bson::{doc, DateTime, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::CurrentAdmin;
use crate::error::{ApiError, ApiJson};
use crate::models::{SiteSettings, SiteSettingsInput, UserDoc};
use crate::routes::{load_layout, load_site, parse_object_id, save_layout, save_site};
use crate::uploads;
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordInput {
    pub current_password: String,
    pub new_password: String,
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

pub async fn stats(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    let docs = state.db.collection::<Document>("docs");
    let doc_total = docs.count_documents(doc! {}).await?;
    let doc_published = docs.count_documents(doc! { "published": true }).await?;
    let doc_groups = docs
        .count_documents(doc! { "group": true, "published": true })
        .await?;
    let doc_pages = docs
        .count_documents(doc! { "group": false, "published": true })
        .await?;
    let contacts = state
        .db
        .collection::<Document>("contacts")
        .count_documents(doc! {})
        .await?;
    let locales = state
        .db
        .collection::<Document>("i18n")
        .count_documents(doc! { "enabled": true })
        .await?;
    let ui_locales = state
        .db
        .collection::<Document>("i18n")
        .count_documents(doc! { "enabled": true, "uiEnabled": true })
        .await?;

    Ok(Json(json!({
        "docs": doc_total,
        "docsPublished": doc_published,
        "docGroups": doc_groups,
        "docPages": doc_pages,
        "docsHidden": doc_total - doc_published,
        "contacts": contacts,
        "locales": locales,
        "uiLocales": ui_locales,
    })))
}

// ---------------------------------------------------------------------------
// Layout and site settings
// ---------------------------------------------------------------------------

pub async fn get_layout(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(load_layout(&state.db).await?))
}

pub async fn put_layout(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiJson(body): ApiJson<Value>,
) -> Result<Json<Value>, ApiError> {
    Ok(Json(save_layout(&state.db, &body).await?))
}

pub async fn get_site(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<SiteSettings>, ApiError> {
    Ok(Json(load_site(&state.db).await?))
}

fn site_upload_files(settings: &SiteSettings) -> std::collections::HashSet<String> {
    let mut files = std::collections::HashSet::new();
    for value in [
        &settings.header_logo,
        &settings.footer_logo,
        &settings.favicon,
        &settings.og_image,
    ] {
        files.extend(uploads::extract_upload_files(value));
    }
    files
}

pub async fn put_site(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiJson(input): ApiJson<SiteSettingsInput>,
) -> Result<Json<SiteSettings>, ApiError> {
    let old_settings = load_site(&state.db).await?;
    let old_images = site_upload_files(&old_settings);
    let settings = save_site(&state.db, input).await?;
    let new_images = site_upload_files(&settings);
    let removed: std::collections::HashSet<String> =
        old_images.difference(&new_images).cloned().collect();
    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed).await;
    Ok(Json(settings))
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

pub async fn change_password(
    State(state): State<AppState>,
    admin: CurrentAdmin,
    ApiJson(input): ApiJson<ChangePasswordInput>,
) -> Result<Json<Value>, ApiError> {
    let id = parse_object_id(&admin.0.sub).map_err(|_| ApiError::unauthorized())?;
    let users = state.db.collection::<UserDoc>("users");
    let user = users
        .find_one(doc! { "_id": id })
        .await?
        .ok_or_else(ApiError::unauthorized)?;

    if !crate::auth::verify_password(&input.current_password, &user.password_hash) {
        return Err(ApiError::bad_request("Mật khẩu hiện tại không đúng."));
    }
    if input.new_password.chars().count() < 6 {
        return Err(ApiError::bad_request(
            "Mật khẩu mới phải có ít nhất 6 ký tự.",
        ));
    }
    if input.new_password == input.current_password {
        return Err(ApiError::bad_request(
            "Mật khẩu mới phải khác mật khẩu hiện tại.",
        ));
    }

    let password_hash = crate::auth::hash_password(&input.new_password)?;
    users
        .update_one(
            doc! { "_id": id },
            doc! { "$set": {
                "passwordHash": password_hash,
                "updatedAt": DateTime::now(),
            } },
        )
        .await?;

    Ok(Json(json!({ "ok": true })))
}
