use axum::extract::{Path, State};
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime, Document};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::CurrentAdmin;
use crate::error::{ApiError, ApiJson};
use crate::models::{
    default_allowed_routes, CmsSettings, CmsSettingsInput, SiteSettings, SiteSettingsInput,
    UserCreateInput, UserDoc, UserDto, UserUpdateInput,
};
use crate::routes::{
    load_cms_settings, load_site, parse_object_id, reset_cms_settings, save_cms_settings,
    save_site,
};
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

pub async fn check_route_access(
    state: &AppState,
    admin: &CurrentAdmin,
    route: &str,
) -> Result<(), ApiError> {
    if admin.0.role == "admin" {
        return Ok(());
    }

    let id = parse_object_id(&admin.0.sub).map_err(|_| ApiError::unauthorized())?;
    let user = state
        .db
        .collection::<UserDoc>("users")
        .find_one(doc! { "_id": id })
        .await?
        .ok_or_else(ApiError::unauthorized)?;

    if user.role == "admin" {
        return Ok(());
    }

    let clean_target = route.trim_start_matches("/admin").trim_start_matches('/');
    let is_allowed = user.allowed_routes.iter().any(|r| {
        let clean_r = r.trim_start_matches("/admin").trim_start_matches('/');
        clean_r == clean_target || (clean_target.is_empty() && clean_r.is_empty())
    });

    if !is_allowed {
        return Err(ApiError::forbidden(
            format!("Bạn không có quyền truy cập vào mục {route}."),
        ));
    }

    Ok(())
}

pub async fn get_site(
    State(state): State<AppState>,
    admin: CurrentAdmin,
) -> Result<Json<SiteSettings>, ApiError> {
    check_route_access(&state, &admin, "/site").await?;
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
    admin: CurrentAdmin,
    ApiJson(input): ApiJson<SiteSettingsInput>,
) -> Result<Json<SiteSettings>, ApiError> {
    check_route_access(&state, &admin, "/site").await?;
    let old_settings = load_site(&state.db).await?;
    let old_images = site_upload_files(&old_settings);
    let settings = save_site(&state.db, input).await?;
    let new_images = site_upload_files(&settings);
    let removed: std::collections::HashSet<String> =
        old_images.difference(&new_images).cloned().collect();
    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed).await;
    Ok(Json(settings))
}

pub async fn get_cms(
    State(state): State<AppState>,
    admin: CurrentAdmin,
) -> Result<Json<CmsSettings>, ApiError> {
    check_route_access(&state, &admin, "/cms-settings").await?;
    Ok(Json(load_cms_settings(&state.db).await?))
}

fn cms_upload_files(settings: &CmsSettings) -> std::collections::HashSet<String> {
    let mut files = std::collections::HashSet::new();
    for value in [&settings.logo_url, &settings.favicon] {
        files.extend(uploads::extract_upload_files(value));
    }
    files
}

pub async fn put_cms(
    State(state): State<AppState>,
    admin: CurrentAdmin,
    ApiJson(input): ApiJson<CmsSettingsInput>,
) -> Result<Json<CmsSettings>, ApiError> {
    check_route_access(&state, &admin, "/cms-settings").await?;

    if admin.0.role != "admin" {
        let mut restricted = CmsSettingsInput::default();
        restricted.token_days = input.token_days;
        let settings = save_cms_settings(&state.db, restricted).await?;
        return Ok(Json(settings));
    }
    let old_settings = load_cms_settings(&state.db).await?;
    let old_images = cms_upload_files(&old_settings);
    let settings = save_cms_settings(&state.db, input).await?;
    let new_images = cms_upload_files(&settings);
    let removed: std::collections::HashSet<String> =
        old_images.difference(&new_images).cloned().collect();
    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed).await;
    Ok(Json(settings))
}

pub async fn reset_cms(
    State(state): State<AppState>,
    admin: CurrentAdmin,
) -> Result<Json<CmsSettings>, ApiError> {
    if admin.0.role != "admin" {
        return Err(ApiError::forbidden(
            "Chỉ quản trị viên mới có quyền đặt lại cài đặt CMS.",
        ));
    }
    Ok(Json(reset_cms_settings(&state.db).await?))
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

pub async fn reset_user_secret(
    State(state): State<AppState>,
    admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    let id = parse_object_id(&admin.0.sub).map_err(|_| ApiError::unauthorized())?;
    let new_secret = crate::auth::generate_random_secret();
    let users = state.db.collection::<UserDoc>("users");
    let result = users
        .update_one(
            doc! { "_id": id },
            doc! {
                "$set": {
                    "secretKey": &new_secret,
                    "updatedAt": DateTime::now(),
                }
            },
        )
        .await?;

    if result.matched_count == 0 {
        return Err(ApiError::unauthorized());
    }

    tracing::info!(user_id = %id, username = %admin.0.username, "Reset user secret key; invalidated existing sessions");
    Ok(Json(json!({
        "ok": true,
        "message": "Đã đổi secret key thành công. Tất cả phiên đăng nhập đã bị thu hồi."
    })))
}

pub async fn list_users(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Vec<crate::models::UserDto>>, ApiError> {
    let users = state
        .db
        .collection::<UserDoc>("users")
        .find(doc! {})
        .sort(doc! { "username": 1 })
        .await?
        .try_collect::<Vec<_>>()
        .await?;
    Ok(Json(users.into_iter().map(UserDoc::into_dto).collect()))
}

pub async fn create_user(
    State(state): State<AppState>,
    admin: CurrentAdmin,
    ApiJson(input): ApiJson<UserCreateInput>,
) -> Result<Json<UserDto>, ApiError> {
    if admin.0.role != "admin" {
        return Err(ApiError::forbidden(
            "Chỉ quản trị viên mới có quyền tạo tài khoản.",
        ));
    }

    let username = input.username.trim();
    if username.is_empty() {
        return Err(ApiError::bad_request("Tên đăng nhập không được để trống."));
    }
    if username.chars().count() < 3 {
        return Err(ApiError::bad_request(
            "Tên đăng nhập phải có ít nhất 3 ký tự.",
        ));
    }
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err(ApiError::bad_request(
            "Tên đăng nhập chỉ chứa chữ cái, số, gạch dưới hoặc gạch ngang.",
        ));
    }

    if input.password.chars().count() < 6 {
        return Err(ApiError::bad_request("Mật khẩu phải có ít nhất 6 ký tự."));
    }

    let users = state.db.collection::<UserDoc>("users");
    if users.find_one(doc! { "username": username }).await?.is_some() {
        return Err(ApiError::bad_request("Tên đăng nhập đã tồn tại."));
    }

    let password_hash = crate::auth::hash_password(&input.password)?;
    let secret_key = crate::auth::generate_random_secret();
    let role = input
        .role
        .as_deref()
        .unwrap_or("editor")
        .trim()
        .to_string();
    let allowed_routes = input
        .allowed_routes
        .unwrap_or_else(default_allowed_routes);

    let now = DateTime::now();
    let user = UserDoc {
        id: ObjectId::new(),
        username: username.to_string(),
        password_hash,
        role,
        secret_key,
        allowed_routes,
        created_at: now,
        updated_at: now,
    };

    users.insert_one(&user).await?;
    tracing::info!(user_id = %user.id, username = %user.username, "Created new user account");
    Ok(Json(user.into_dto()))
}

pub async fn update_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    admin: CurrentAdmin,
    ApiJson(input): ApiJson<UserUpdateInput>,
) -> Result<Json<UserDto>, ApiError> {
    if admin.0.role != "admin" {
        return Err(ApiError::forbidden(
            "Chỉ quản trị viên mới có quyền cập nhật người dùng.",
        ));
    }

    let object_id = parse_object_id(&id)?;
    let users = state.db.collection::<UserDoc>("users");
    let mut user = users
        .find_one(doc! { "_id": object_id })
        .await?
        .ok_or_else(|| ApiError::not_found("Không tìm thấy người dùng."))?;

    let mut update_doc = Document::new();

    if let Some(role) = input.role {
        user.role = role.trim().to_string();
        update_doc.insert("role", &user.role);
    }
    if let Some(routes) = input.allowed_routes {
        user.allowed_routes = routes;
        update_doc.insert(
            "allowedRoutes",
            Bson::Array(
                user.allowed_routes
                    .iter()
                    .map(|r| Bson::String(r.clone()))
                    .collect(),
            ),
        );
    }
    if let Some(password) = input.password {
        if password.chars().count() < 6 {
            return Err(ApiError::bad_request("Mật khẩu mới phải có ít nhất 6 ký tự."));
        }
        let password_hash = crate::auth::hash_password(&password)?;
        user.password_hash = password_hash.clone();
        update_doc.insert("passwordHash", password_hash);
    }

    if !update_doc.is_empty() {
        update_doc.insert("updatedAt", DateTime::now());
        users
            .update_one(doc! { "_id": object_id }, doc! { "$set": update_doc })
            .await?;
    }

    Ok(Json(user.into_dto()))
}

pub async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<String>,
    admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    if admin.0.role != "admin" {
        return Err(ApiError::forbidden(
            "Chỉ quản trị viên mới có quyền xóa tài khoản.",
        ));
    }

    let object_id = parse_object_id(&id)?;
    if admin.0.sub == id {
        return Err(ApiError::bad_request(
            "Không thể tự xóa tài khoản của chính mình.",
        ));
    }

    let users = state.db.collection::<UserDoc>("users");
    let res = users.delete_one(doc! { "_id": object_id }).await?;
    if res.deleted_count == 0 {
        return Err(ApiError::not_found("Không tìm thấy người dùng."));
    }

    tracing::info!(user_id = %id, "Deleted user account");
    Ok(Json(json!({ "ok": true })))
}
