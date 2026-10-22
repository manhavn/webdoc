pub mod admin;
pub mod appearance;
pub mod auth;
pub mod backup;
pub mod docs;
pub mod i18n;
pub mod public;

use mongodb::bson::{doc, oid::ObjectId, Bson, Document};
use mongodb::Database;
use serde_json::{json, Value};

use crate::bson_json::{document_to_json, json_to_bson};
use crate::error::ApiError;
use crate::models::{normalize_layout, SiteSettings, SiteSettingsInput};

const LAYOUT_JSON: &str = include_str!("../seed_data/layout.json");

pub fn default_layout() -> Value {
    serde_json::from_str(LAYOUT_JSON).unwrap_or_else(|_| json!({ "slug": "home", "sections": [] }))
}

pub async fn load_layout(db: &Database) -> Result<Value, ApiError> {
    let layout = db.collection::<Document>("layout");
    match layout.find_one(doc! { "slug": "home" }).await? {
        Some(document) => {
            let value = document_to_json(&document);
            Ok(normalize_layout(&value).unwrap_or_else(|_| default_layout()))
        }
        None => Ok(default_layout()),
    }
}

pub async fn save_layout(db: &Database, input: &Value) -> Result<Value, ApiError> {
    let normalized = normalize_layout(input).map_err(ApiError::bad_request)?;
    let Bson::Document(mut document) = json_to_bson(normalized.clone()) else {
        return Err(ApiError::bad_request("Layout không hợp lệ."));
    };
    document.insert("slug", "home");
    db.collection::<Document>("layout")
        .update_one(doc! { "slug": "home" }, doc! { "$set": document })
        .upsert(true)
        .await?;
    Ok(normalized)
}

pub async fn load_site(db: &Database) -> Result<SiteSettings, ApiError> {
    let settings = db
        .collection::<SiteSettings>("settings")
        .find_one(doc! { "key": "site" })
        .await?;
    Ok(settings.unwrap_or_default())
}

pub async fn save_site(db: &Database, input: SiteSettingsInput) -> Result<SiteSettings, ApiError> {
    let mut settings = load_site(db).await?;
    settings.apply(input);

    let mut document = mongodb::bson::to_document(&settings)?;
    document.insert("key", "site");
    db.collection::<Document>("settings")
        .update_one(doc! { "key": "site" }, doc! { "$set": document })
        .upsert(true)
        .await?;
    Ok(settings)
}

pub fn bson_to_i32(value: &Bson) -> i32 {
    match value {
        Bson::Int32(v) => *v,
        Bson::Int64(v) => *v as i32,
        Bson::Double(v) => *v as i32,
        Bson::Decimal128(v) => v.to_string().parse().unwrap_or(0),
        _ => 0,
    }
}

pub fn parse_object_id(value: &str) -> Result<ObjectId, ApiError> {
    ObjectId::parse_str(value.trim()).map_err(|_| ApiError::bad_request("ID không hợp lệ."))
}
