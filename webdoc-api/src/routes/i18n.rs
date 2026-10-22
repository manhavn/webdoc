use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, DateTime};
use mongodb::Database;

use crate::auth::CurrentAdmin;
use crate::error::{is_duplicate_key, ApiError, ApiJson};
use crate::models::{
    i18n_messages_document, valid_locale_code, I18nAdminDto, I18nConfigDto, I18nCreateInput,
    I18nDoc, I18nLocaleDto, I18nMessagesDto, I18nUpdateInput,
};
use crate::AppState;

pub(crate) const COLLECTION: &str = "i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn load_all(db: &Database) -> Result<Vec<I18nDoc>, ApiError> {
    Ok(db
        .collection::<I18nDoc>(COLLECTION)
        .find(doc! {})
        .sort(doc! { "order": 1, "name": 1 })
        .await?
        .try_collect()
        .await?)
}

async fn find_by_code(db: &Database, code: &str) -> Result<Option<I18nDoc>, ApiError> {
    Ok(db
        .collection::<I18nDoc>(COLLECTION)
        .find_one(doc! { "code": code })
        .await?)
}

fn not_found() -> ApiError {
    ApiError::not_found("Không tìm thấy ngôn ngữ.")
}

fn format_messages(
    value: &serde_json::Value,
    field: &str,
) -> Result<mongodb::bson::Document, ApiError> {
    i18n_messages_document(value, field).map_err(ApiError::bad_request)
}

/// Clear `isDefault` on every locale except `code`.
async fn clear_other_defaults(db: &Database, code: &str) -> Result<(), ApiError> {
    db.collection::<I18nDoc>(COLLECTION)
        .update_many(
            doc! { "code": { "$ne": code }, "isDefault": true },
            doc! { "$set": { "isDefault": false } },
        )
        .await?;
    Ok(())
}

async fn other_enabled_count(db: &Database, code: &str) -> Result<u64, ApiError> {
    Ok(db
        .collection::<I18nDoc>(COLLECTION)
        .count_documents(doc! { "code": { "$ne": code }, "enabled": true })
        .await?)
}

/// Clear `uiDefault` on every locale except `code`.
async fn clear_other_ui_defaults(db: &Database, code: &str) -> Result<(), ApiError> {
    db.collection::<I18nDoc>(COLLECTION)
        .update_many(
            doc! { "code": { "$ne": code }, "uiDefault": true },
            doc! { "$set": { "uiDefault": false } },
        )
        .await?;
    Ok(())
}

/// Number of locales other than `code` that the public site may show.
async fn other_ui_visible_count(db: &Database, code: &str) -> Result<u64, ApiError> {
    Ok(db
        .collection::<I18nDoc>(COLLECTION)
        .count_documents(doc! {
            "code": { "$ne": code },
            "enabled": true,
            "uiEnabled": true,
        })
        .await?)
}

/// Promote another visible locale to UI default when the current one is
/// hidden/disabled. Returns false when no replacement exists.
async fn promote_ui_default(db: &Database, exclude: &str) -> Result<bool, ApiError> {
    let replacement = db
        .collection::<I18nDoc>(COLLECTION)
        .find_one(doc! {
            "code": { "$ne": exclude },
            "enabled": true,
            "uiEnabled": true,
        })
        .sort(doc! { "order": 1, "name": 1 })
        .await?;
    let Some(replacement) = replacement else {
        return Ok(false);
    };
    db.collection::<I18nDoc>(COLLECTION)
        .update_one(
            doc! { "code": &replacement.code },
            doc! { "$set": { "uiDefault": true } },
        )
        .await?;
    clear_other_ui_defaults(db, &replacement.code).await?;
    Ok(true)
}

// ---------------------------------------------------------------------------
// Public endpoints
// ---------------------------------------------------------------------------

/// GET /i18n — enabled locales plus the active default and public-UI default.
pub async fn config(State(state): State<AppState>) -> Result<Json<I18nConfigDto>, ApiError> {
    let docs: Vec<I18nDoc> = load_all(&state.db)
        .await?
        .into_iter()
        .filter(|locale| locale.enabled)
        .collect();

    // `defaultLocale` keeps following the CMS-wide flag; `uiDefaultLocale`
    // only ever points at a locale the public site may offer.
    let default_locale = docs
        .iter()
        .find(|locale| locale.is_default)
        .or_else(|| docs.first())
        .map(|locale| locale.code.clone())
        .unwrap_or_default();
    let ui_default_locale = docs
        .iter()
        .find(|locale| locale.ui_default && locale.ui_enabled)
        .or_else(|| docs.iter().find(|locale| locale.ui_enabled))
        .or_else(|| docs.first())
        .map(|locale| locale.code.clone())
        .unwrap_or_default();

    let locales = docs
        .into_iter()
        .map(|locale| I18nLocaleDto {
            code: locale.code,
            name: locale.name,
            order: locale.order,
            ui_enabled: locale.ui_enabled,
        })
        .collect();

    Ok(Json(I18nConfigDto {
        default_locale,
        ui_default_locale,
        locales,
    }))
}

/// GET /i18n/:code — translation dictionaries for one enabled locale.
pub async fn messages(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<I18nMessagesDto>, ApiError> {
    let locale = state
        .db
        .collection::<I18nDoc>(COLLECTION)
        .find_one(doc! { "code": &code, "enabled": true })
        .await?
        .ok_or_else(not_found)?;

    Ok(Json(I18nMessagesDto {
        code: locale.code,
        name: locale.name,
        ui: locale.ui,
        admin: locale.admin,
    }))
}

// ---------------------------------------------------------------------------
// Admin endpoints
// ---------------------------------------------------------------------------

/// GET /admin/i18n — every locale, including disabled ones.
pub async fn admin_list(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Vec<I18nAdminDto>>, ApiError> {
    let docs = load_all(&state.db).await?;
    Ok(Json(
        docs.into_iter().map(I18nDoc::into_dto).collect::<Vec<_>>(),
    ))
}

/// GET /admin/i18n/:code
pub async fn admin_get(
    State(state): State<AppState>,
    Path(code): Path<String>,
    _admin: CurrentAdmin,
) -> Result<Json<I18nAdminDto>, ApiError> {
    let locale = find_by_code(&state.db, &code)
        .await?
        .ok_or_else(not_found)?;
    Ok(Json(locale.into_dto()))
}

/// POST /admin/i18n
pub async fn admin_create(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiJson(input): ApiJson<I18nCreateInput>,
) -> Result<Json<I18nAdminDto>, ApiError> {
    let code = input.code.trim().to_string();
    if !valid_locale_code(&code) {
        return Err(ApiError::bad_request(
            "Mã ngôn ngữ phải có dạng \"en\" hoặc \"pt-BR\".",
        ));
    }

    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::bad_request("Tên ngôn ngữ không được để trống."));
    }

    let ui = format_messages(
        input
            .ui
            .as_ref()
            .ok_or_else(|| ApiError::bad_request("Thiếu trường ui."))?,
        "ui",
    )?;
    let admin = format_messages(
        input
            .admin
            .as_ref()
            .ok_or_else(|| ApiError::bad_request("Thiếu trường admin."))?,
        "admin",
    )?;

    let enabled = input.enabled.unwrap_or(true);
    let is_default = input.is_default.unwrap_or(false);
    let ui_enabled = input.ui_enabled.unwrap_or(enabled);
    let ui_default = input.ui_default.unwrap_or(false);
    if is_default && !enabled {
        return Err(ApiError::bad_request("Ngôn ngữ mặc định phải được bật."));
    }
    if ui_enabled && !enabled {
        return Err(ApiError::bad_request(
            "Ngôn ngữ hiển thị trên giao diện phải được bật.",
        ));
    }
    if ui_default && !(enabled && ui_enabled) {
        return Err(ApiError::bad_request(
            "Ngôn ngữ mặc định của giao diện phải được bật và hiển thị.",
        ));
    }
    if !enabled && other_enabled_count(&state.db, &code).await? == 0 {
        return Err(ApiError::bad_request(
            "Phải có ít nhất một ngôn ngữ được bật.",
        ));
    }

    if find_by_code(&state.db, &code).await?.is_some() {
        return Err(ApiError::new(
            StatusCode::CONFLICT,
            "Mã ngôn ngữ đã tồn tại.",
        ));
    }

    let collection = state.db.collection::<I18nDoc>(COLLECTION);
    let order = match input.order {
        Some(order) => order,
        None => collection
            .find_one(doc! {})
            .sort(doc! { "order": -1, "name": -1 })
            .await?
            .map(|locale| locale.order + 1)
            .unwrap_or(1),
    };

    let now = DateTime::now();
    let locale = I18nDoc {
        id: mongodb::bson::oid::ObjectId::new(),
        code: code.clone(),
        name,
        enabled,
        is_default,
        ui_enabled,
        ui_default,
        order,
        ui,
        admin,
        created_at: now,
        updated_at: now,
    };

    if let Err(err) = collection.insert_one(&locale).await {
        if is_duplicate_key(&err) {
            return Err(ApiError::new(
                StatusCode::CONFLICT,
                "Mã ngôn ngữ đã tồn tại.",
            ));
        }
        return Err(err.into());
    }

    if is_default {
        clear_other_defaults(&state.db, &code).await?;
    }
    if ui_default {
        clear_other_ui_defaults(&state.db, &code).await?;
    }

    Ok(Json(locale.into_dto()))
}

/// PUT /admin/i18n/:code — partial update.
pub async fn admin_update(
    State(state): State<AppState>,
    Path(code): Path<String>,
    _admin: CurrentAdmin,
    ApiJson(input): ApiJson<I18nUpdateInput>,
) -> Result<Json<I18nAdminDto>, ApiError> {
    let mut locale = find_by_code(&state.db, &code)
        .await?
        .ok_or_else(not_found)?;

    if let Some(name) = input.name {
        let name = name.trim();
        if name.is_empty() {
            return Err(ApiError::bad_request("Tên ngôn ngữ không được để trống."));
        }
        locale.name = name.to_string();
    }
    if let Some(value) = input.ui.as_ref() {
        locale.ui = format_messages(value, "ui")?;
    }
    if let Some(value) = input.admin.as_ref() {
        locale.admin = format_messages(value, "admin")?;
    }

    let enabled = input.enabled.unwrap_or(locale.enabled);
    let is_default = input.is_default.unwrap_or(locale.is_default);
    let mut ui_enabled = input.ui_enabled.unwrap_or(locale.ui_enabled);
    let mut ui_default = input.ui_default.unwrap_or(locale.ui_default);

    // A globally disabled locale can never stay visible on the public site.
    if !enabled && ui_enabled {
        if input.ui_enabled == Some(true) {
            return Err(ApiError::bad_request(
                "Ngôn ngữ hiển thị trên giao diện phải được bật.",
            ));
        }
        ui_enabled = false;
    }

    if locale.is_default && input.is_default == Some(false) {
        return Err(ApiError::bad_request(
            "Không thể bỏ ngôn ngữ mặc định. Hãy đặt ngôn ngữ khác làm mặc định trước.",
        ));
    }
    if locale.is_default && !enabled {
        return Err(ApiError::bad_request("Không thể tắt ngôn ngữ mặc định."));
    }
    if is_default && !enabled {
        return Err(ApiError::bad_request("Ngôn ngữ mặc định phải được bật."));
    }
    if locale.enabled && !enabled && other_enabled_count(&state.db, &code).await? == 0 {
        return Err(ApiError::bad_request(
            "Phải có ít nhất một ngôn ngữ được bật.",
        ));
    }

    if input.ui_default == Some(true) && !(enabled && ui_enabled) {
        return Err(ApiError::bad_request(
            "Ngôn ngữ mặc định của giao diện phải được bật và hiển thị.",
        ));
    }
    // Hiding/globally disabling the current UI default promotes the next
    // visible locale automatically. This makes "hide English, keep Vietnamese"
    // a single click instead of requiring a separate Set website default step.
    if locale.ui_default && (!ui_enabled || input.ui_default == Some(false)) {
        if other_ui_visible_count(&state.db, &code).await? == 0 {
            return Err(ApiError::bad_request(
                "Phải có ít nhất một ngôn ngữ hiển thị trên giao diện.",
            ));
        }
        promote_ui_default(&state.db, &code).await?;
        ui_default = false;
    }
    if locale.ui_enabled && !ui_enabled && other_ui_visible_count(&state.db, &code).await? == 0 {
        return Err(ApiError::bad_request(
            "Phải có ít nhất một ngôn ngữ hiển thị trên giao diện.",
        ));
    }
    if let Some(order) = input.order {
        locale.order = order;
    }

    locale.enabled = enabled;
    locale.is_default = is_default;
    locale.ui_enabled = ui_enabled;
    locale.ui_default = ui_default;
    locale.updated_at = DateTime::now();

    if is_default {
        clear_other_defaults(&state.db, &code).await?;
    }
    if ui_default {
        clear_other_ui_defaults(&state.db, &code).await?;
    }

    state
        .db
        .collection::<I18nDoc>(COLLECTION)
        .replace_one(doc! { "code": &code }, &locale)
        .await?;

    Ok(Json(locale.into_dto()))
}

/// DELETE /admin/i18n/:code
pub async fn admin_delete(
    State(state): State<AppState>,
    Path(code): Path<String>,
    _admin: CurrentAdmin,
) -> Result<Json<serde_json::Value>, ApiError> {
    let locale = find_by_code(&state.db, &code)
        .await?
        .ok_or_else(not_found)?;

    if locale.is_default {
        return Err(ApiError::bad_request("Không thể xoá ngôn ngữ mặc định."));
    }
    if locale.ui_default {
        return Err(ApiError::bad_request(
            "Không thể xoá ngôn ngữ mặc định của giao diện.",
        ));
    }
    if locale.enabled && other_enabled_count(&state.db, &code).await? == 0 {
        return Err(ApiError::bad_request(
            "Không thể xoá ngôn ngữ đang bật cuối cùng.",
        ));
    }
    if locale.ui_enabled && other_ui_visible_count(&state.db, &code).await? == 0 {
        return Err(ApiError::bad_request(
            "Không thể xoá ngôn ngữ hiển thị cuối cùng trên giao diện.",
        ));
    }

    state
        .db
        .collection::<I18nDoc>(COLLECTION)
        .delete_one(doc! { "code": &code })
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

/// POST /admin/i18n/reset — restore the bundled EN/VI core configuration.
///
/// EN and VI are upserted from `seed_data/i18n.json` (name, order and
/// dictionaries) with EN as the CMS and public-UI default and VI visible but
/// not default. Every other locale stays in the CMS but is removed from the
/// public site; its `enabled` flag and dictionaries are left untouched.
pub async fn admin_reset(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Vec<I18nAdminDto>>, ApiError> {
    let seeds = crate::seed::seed_locales().map_err(ApiError::internal)?;
    let collection = state.db.collection::<I18nDoc>(COLLECTION);
    let now = DateTime::now();

    for seed in seeds
        .iter()
        .filter(|locale| locale.code == "en" || locale.code == "vi")
    {
        let is_english = seed.code == "en";
        collection
            .update_one(
                doc! { "code": &seed.code },
                doc! {
                    "$set": {
                        "name": &seed.name,
                        "enabled": true,
                        "isDefault": is_english,
                        "uiEnabled": true,
                        "uiDefault": is_english,
                        "order": seed.order,
                        "ui": seed.ui.clone(),
                        "admin": seed.admin.clone(),
                        "updated_at": now,
                    },
                    "$setOnInsert": { "created_at": now },
                },
            )
            .await?;
    }

    collection
        .update_many(
            doc! { "code": { "$nin": ["en", "vi"] } },
            doc! {
                "$set": {
                    "isDefault": false,
                    "uiDefault": false,
                    "uiEnabled": false,
                    "updated_at": now,
                },
            },
        )
        .await?;

    let locales = load_all(&state.db).await?;
    Ok(Json(
        locales
            .into_iter()
            .map(I18nDoc::into_dto)
            .collect::<Vec<_>>(),
    ))
}
