use std::collections::HashMap;
use std::error::Error;

use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime, Document};
use mongodb::Database;
use serde::Deserialize;
use serde_json::Value;

use crate::auth;
use crate::bson_json::json_to_bson;
use crate::config::Config;
use crate::docs;
use crate::models::{
    i18n_messages_document, normalize_layout, valid_locale_code, DocNode, I18nDoc, SiteSettings,
    UserDoc,
};

const LAYOUT_JSON: &str = include_str!("seed_data/layout.json");
const SITE_JSON: &str = include_str!("seed_data/site.json");
const APPEARANCE_DEMO_JSON: &str = include_str!("seed_data/appearance_demo.json");
const JOURNALS_JSON: &str = include_str!("seed_data/journals.json");
const DOCS_JSON: &str = include_str!("seed_data/docs.json");
const I18N_JSON: &str = include_str!("seed_data/i18n.json");

/// Bootstrap only the minimum needed to operate an empty installation: the
/// admin account and interface translations. Business content stays empty.
pub async fn seed_core(db: &Database, config: &Config) -> Result<(), Box<dyn Error>> {
    let now = DateTime::now();
    seed_admin(db, config, now).await?;
    seed_i18n(db, now).await?;
    Ok(())
}

/// Opt-in demo content (`--seed`). Never overwrites existing collections.
pub async fn seed_demo(db: &Database) -> Result<(), Box<dyn Error>> {
    let now = DateTime::now();
    seed_journals(db).await?;
    seed_layout(db).await?;
    seed_site(db).await?;
    seed_appearance(db).await?;
    seed_docs(db, now).await?;
    Ok(())
}

async fn seed_admin(db: &Database, config: &Config, now: DateTime) -> Result<(), Box<dyn Error>> {
    let users = db.collection::<UserDoc>("users");
    if users.count_documents(doc! {}).await? > 0 {
        return Ok(());
    }

    let password_hash =
        auth::hash_password(&config.admin_password).map_err(|err| err.to_string())?;
    let admin = UserDoc {
        id: ObjectId::new(),
        username: config.admin_username.clone(),
        password_hash,
        role: "admin".to_string(),
        created_at: now,
        updated_at: now,
    };
    users.insert_one(admin).await?;
    tracing::info!(username = %config.admin_username, "Seeded administrator account");
    Ok(())
}

async fn seed_journals(db: &Database) -> Result<(), Box<dyn Error>> {
    let journals = db.collection::<Document>("journals");
    if journals.count_documents(doc! {}).await? > 0 {
        return Ok(());
    }

    let items: Vec<Value> = serde_json::from_str(JOURNALS_JSON)?;
    let mut docs = Vec::with_capacity(items.len());
    for (index, item) in items.iter().enumerate() {
        let mut document = Document::new();
        document.insert(
            "name",
            item.get("name").and_then(Value::as_str).unwrap_or_default(),
        );
        document.insert(
            "org",
            item.get("org").and_then(Value::as_str).unwrap_or_default(),
        );
        document.insert(
            "logo",
            item.get("logo").and_then(Value::as_str).unwrap_or_default(),
        );
        document.insert(
            "url",
            item.get("url").and_then(Value::as_str).unwrap_or_default(),
        );
        document.insert("order", Bson::Int32((index as i32) + 1));
        docs.push(document);
    }

    let count = docs.len();
    journals.insert_many(docs).await?;
    tracing::info!(count, "Seeded journals");
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedI18n {
    code: String,
    name: String,
    #[serde(default = "default_seed_enabled")]
    enabled: bool,
    #[serde(default)]
    is_default: bool,
    #[serde(default)]
    ui_enabled: Option<bool>,
    #[serde(default)]
    ui_default: Option<bool>,
    #[serde(default)]
    order: i32,
    #[serde(default)]
    ui: Value,
    #[serde(default)]
    admin: Value,
}

fn default_seed_enabled() -> bool {
    true
}

/// A bundled locale after validation. `ui` and `admin` are already flat
/// documents, ready to be stored.
#[derive(Debug, Clone)]
pub struct SeedLocale {
    pub code: String,
    pub name: String,
    pub enabled: bool,
    pub is_default: bool,
    pub ui_enabled: bool,
    pub ui_default: bool,
    pub order: i32,
    pub ui: Document,
    pub admin: Document,
}

/// Parse and validate `seed_data/i18n.json`.
///
/// Shared by the initial seed and the admin "reset language defaults" action
/// so both always install the same EN/VI core configuration. A broken file can
/// never produce zero (or several) defaults, a hidden default, or every
/// locale disabled.
pub fn seed_locales() -> Result<Vec<SeedLocale>, String> {
    let seeds: Vec<SeedI18n> = serde_json::from_str(I18N_JSON).map_err(|err| err.to_string())?;
    let mut codes = std::collections::HashSet::with_capacity(seeds.len());
    let mut enabled = 0usize;
    let mut defaults = 0usize;
    let mut defaults_enabled = 0usize;
    let mut ui_visible = 0usize;
    let mut ui_defaults = 0usize;
    let mut locales = Vec::with_capacity(seeds.len());

    for seed in &seeds {
        let code = seed.code.trim().to_string();
        if !valid_locale_code(&code) {
            return Err(format!(
                "i18n seed has an invalid locale code: {}",
                seed.code
            ));
        }
        if !codes.insert(code.clone()) {
            return Err(format!("i18n seed repeats locale code {code}"));
        }
        let name = seed.name.trim();
        if name.is_empty() {
            return Err(format!("i18n seed locale {code} has an empty name"));
        }
        // Seeds written before the public-UI split inherit the CMS flags.
        let ui_enabled = seed.ui_enabled.unwrap_or(seed.enabled);
        let ui_default = seed.ui_default.unwrap_or(seed.is_default);
        if ui_enabled && !seed.enabled {
            return Err(format!(
                "i18n seed locale {code} cannot be visible in the UI while disabled"
            ));
        }
        if ui_default && !(seed.enabled && ui_enabled) {
            return Err(format!(
                "i18n seed locale {code} must be enabled and UI-visible to be the UI default"
            ));
        }

        if seed.enabled {
            enabled += 1;
        }
        if seed.is_default {
            defaults += 1;
            if seed.enabled {
                defaults_enabled += 1;
            }
        }
        if ui_enabled {
            ui_visible += 1;
        }
        if ui_default {
            ui_defaults += 1;
        }

        let ui = i18n_messages_document(&seed.ui, "ui").map_err(|err| format!("{code}: {err}"))?;
        let admin =
            i18n_messages_document(&seed.admin, "admin").map_err(|err| format!("{code}: {err}"))?;

        locales.push(SeedLocale {
            code,
            name: name.to_string(),
            enabled: seed.enabled,
            is_default: seed.is_default,
            ui_enabled,
            ui_default,
            order: seed.order,
            ui,
            admin,
        });
    }

    if enabled == 0 {
        return Err("i18n seed must enable at least one locale".into());
    }
    if defaults != 1 {
        return Err("i18n seed must mark exactly one default locale".into());
    }
    if defaults_enabled != 1 {
        return Err("i18n seed default locale must be enabled".into());
    }
    if ui_visible == 0 {
        return Err("i18n seed must show at least one locale on the website".into());
    }
    if ui_defaults != 1 {
        return Err("i18n seed must mark exactly one UI default locale".into());
    }

    Ok(locales)
}

/// Seed the interface translations from `seed_data/i18n.json`.
async fn seed_i18n(db: &Database, now: DateTime) -> Result<(), Box<dyn Error>> {
    let collection = db.collection::<I18nDoc>("i18n");
    if collection.count_documents(doc! {}).await? > 0 {
        // Newer builds add message keys. Merge only the missing ones so an
        // existing installation gains the new labels without losing any
        // translation a user has already edited.
        for seed in seed_locales()? {
            let Some(existing) = collection.find_one(doc! { "code": &seed.code }).await? else {
                continue;
            };
            let mut ui = existing.ui;
            let mut admin = existing.admin;
            let mut changed = false;
            for (key, value) in seed.ui {
                if !ui.contains_key(&key) {
                    ui.insert(key, value);
                    changed = true;
                }
            }
            for (key, value) in seed.admin {
                if !admin.contains_key(&key) {
                    admin.insert(key, value);
                    changed = true;
                }
            }
            if changed {
                collection
                    .update_one(
                        doc! { "_id": existing.id },
                        doc! { "$set": { "ui": ui, "admin": admin, "updated_at": now } },
                    )
                    .await?;
            }
        }
        return Ok(());
    }

    let locales = seed_locales()?;
    let documents: Vec<I18nDoc> = locales
        .into_iter()
        .map(|locale| I18nDoc {
            id: ObjectId::new(),
            code: locale.code,
            name: locale.name,
            enabled: locale.enabled,
            is_default: locale.is_default,
            ui_enabled: locale.ui_enabled,
            ui_default: locale.ui_default,
            order: locale.order,
            ui: locale.ui,
            admin: locale.admin,
            created_at: now,
            updated_at: now,
        })
        .collect();

    let count = documents.len();
    collection.insert_many(documents).await?;
    tracing::info!(count, "Seeded interface translations");
    Ok(())
}

async fn seed_layout(db: &Database) -> Result<(), Box<dyn Error>> {
    let layout = db.collection::<Document>("layout");
    if layout.count_documents(doc! {}).await? > 0 {
        return Ok(());
    }

    let raw: Value = serde_json::from_str(LAYOUT_JSON)?;
    let normalized = normalize_layout(&raw).map_err(|err| err.to_string())?;
    let Bson::Document(mut document) = json_to_bson(normalized) else {
        return Err("Layout seed is not an object".into());
    };
    document.insert("slug", "home");
    layout.insert_one(document).await?;
    tracing::info!("Seeded homepage layout");
    Ok(())
}

async fn seed_site(db: &Database) -> Result<(), Box<dyn Error>> {
    let settings = db.collection::<Document>("settings");
    if settings.count_documents(doc! {}).await? > 0 {
        return Ok(());
    }

    let defaults: SiteSettings = serde_json::from_str(SITE_JSON)?;
    let mut document = mongodb::bson::to_document(&defaults)?;
    document.insert("key", "site");
    settings.insert_one(document).await?;
    tracing::info!("Seeded site settings");
    Ok(())
}

/// Seed the bundled appearance document when it is still missing, so an
/// installation created before this feature gains it on the next start.
async fn seed_appearance(db: &Database) -> Result<(), Box<dyn Error>> {
    let settings = db.collection::<Document>("settings");
    if settings
        .find_one(doc! { "key": "appearance" })
        .await?
        .is_some()
    {
        return Ok(());
    }

    let raw: Value = serde_json::from_str(APPEARANCE_DEMO_JSON)?;
    let normalized =
        crate::routes::appearance::normalize_appearance(&raw).map_err(|err| err.to_string())?;
    let Bson::Document(mut document) = json_to_bson(normalized) else {
        return Err("Appearance seed is not an object".into());
    };
    document.insert("key", "appearance");
    settings
        .update_one(doc! { "key": "appearance" }, doc! { "$set": document })
        .upsert(true)
        .await?;
    tracing::info!("Seeded appearance settings");
    Ok(())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedDoc {
    title: String,
    slug: String,
    path: String,
    #[serde(default)]
    parent_path: Option<String>,
    #[serde(default)]
    group: bool,
    #[serde(default)]
    order: i32,
    #[serde(default)]
    description: String,
    #[serde(default)]
    content: String,
    #[serde(default = "default_published")]
    published: bool,
}

fn default_published() -> bool {
    true
}

/// Seed the documentation tree from `seed_data/docs.json`, resolving
/// `parentPath` to a real `parentId` in a second pass.
async fn seed_docs(db: &Database, now: DateTime) -> Result<(), Box<dyn Error>> {
    let docs = db.collection::<DocNode>("docs");
    if docs.count_documents(doc! {}).await? > 0 {
        return Ok(());
    }

    let seeds: Vec<SeedDoc> = serde_json::from_str(DOCS_JSON)?;
    let mut ids: HashMap<String, ObjectId> = HashMap::with_capacity(seeds.len());
    for seed in &seeds {
        ids.insert(docs::normalize_path(&seed.path), ObjectId::new());
    }

    let mut nodes = Vec::with_capacity(seeds.len());
    for seed in &seeds {
        let path = docs::normalize_path(&seed.path);
        let id = *ids
            .get(&path)
            .ok_or_else(|| format!("Docs seed is missing a generated id for {path}"))?;
        let parent_path = seed.parent_path.as_deref().map(docs::normalize_path);
        let parent_id = match parent_path.as_deref() {
            Some(parent) if parent != "/" => Some(
                *ids.get(parent)
                    .ok_or_else(|| format!("Docs seed references missing parent {parent}"))?,
            ),
            _ => None,
        };

        nodes.push(DocNode {
            id,
            title: seed.title.clone(),
            slug: seed.slug.clone(),
            path,
            parent_id,
            group: seed.group,
            order: seed.order,
            description: seed.description.clone(),
            content: seed.content.clone(),
            published: seed.published,
            created_at: now,
            updated_at: now,
        });
    }

    let count = nodes.len();
    docs.insert_many(nodes).await?;
    tracing::info!(count, "Seeded documentation tree");
    Ok(())
}
