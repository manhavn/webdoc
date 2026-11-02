pub mod admin;
pub mod appearance;
pub mod auth;
pub mod backup;
pub mod docs;
pub mod i18n;
pub mod public;

use mongodb::bson::{doc, oid::ObjectId, Document};
use mongodb::Database;

use crate::error::ApiError;
use crate::models::{CmsSettings, CmsSettingsInput, SiteSettings, SiteSettingsInput};


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

    if let Ok(mut cms) = load_cms_settings(db).await {
        if cms.brand_name.is_empty() || cms.brand_name == "WebDoc Demo" {
            cms.brand_name = settings.site_name.clone();
            let mut cms_doc = mongodb::bson::to_document(&cms)?;
            cms_doc.insert("key", "cms");
            let _ = db
                .collection::<Document>("settings")
                .update_one(doc! { "key": "cms" }, doc! { "$set": cms_doc })
                .upsert(true)
                .await;
        }
    }

    Ok(settings)
}

pub async fn load_cms_settings(db: &Database) -> Result<CmsSettings, ApiError> {
    let settings = db
        .collection::<CmsSettings>("settings")
        .find_one(doc! { "key": "cms" })
        .await?;
    let mut cms = settings.unwrap_or_default();
    if cms.brand_name.is_empty() || cms.brand_name == "WebDoc Demo" {
        if let Ok(site) = load_site(db).await {
            if !site.site_name.is_empty() && site.site_name != "WebDoc Demo" {
                cms.brand_name = site.site_name;
            }
        }
    }
    if cms.login_panel_bg.is_empty() && !cms.colors.login_panel_bg.is_empty() {
        cms.login_panel_bg = cms.colors.login_panel_bg.clone();
    } else if !cms.login_panel_bg.is_empty() && cms.colors.login_panel_bg.is_empty() {
        cms.colors.login_panel_bg = cms.login_panel_bg.clone();
    }
    Ok(cms)
}

pub async fn save_cms_settings(
    db: &Database,
    input: CmsSettingsInput,
) -> Result<CmsSettings, ApiError> {
    let mut settings = load_cms_settings(db).await?;
    settings.apply(input);

    let mut document = mongodb::bson::to_document(&settings)?;
    document.insert("key", "cms");
    db.collection::<Document>("settings")
        .update_one(doc! { "key": "cms" }, doc! { "$set": document })
        .upsert(true)
        .await?;
    Ok(settings)
}

pub async fn reset_cms_settings(db: &Database) -> Result<CmsSettings, ApiError> {
    let defaults = CmsSettings::default();
    let mut document = mongodb::bson::to_document(&defaults)?;
    document.insert("key", "cms");
    db.collection::<Document>("settings")
        .update_one(doc! { "key": "cms" }, doc! { "$set": document })
        .upsert(true)
        .await?;
    Ok(defaults)
}


pub fn parse_object_id(value: &str) -> Result<ObjectId, ApiError> {
    ObjectId::parse_str(value.trim()).map_err(|_| ApiError::bad_request("ID không hợp lệ."))
}
