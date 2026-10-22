use mongodb::bson::{oid::ObjectId, Bson, DateTime, Document};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

pub fn rfc3339(value: DateTime) -> Option<String> {
    value.try_to_rfc3339_string().ok()
}

// ---------------------------------------------------------------------------
// Documents, users, site settings
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocNode {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub title: String,
    pub slug: String,
    pub path: String,
    #[serde(default)]
    pub parent_id: Option<ObjectId>,
    #[serde(default)]
    pub group: bool,
    #[serde(default)]
    pub order: i32,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub published: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

impl DocNode {
    pub fn to_summary(&self, children: Vec<DocSummaryDto>) -> DocSummaryDto {
        DocSummaryDto {
            id: self.id.to_hex(),
            title: self.title.clone(),
            slug: self.slug.clone(),
            path: self.path.clone(),
            parent_id: self.parent_id.map(|id| id.to_hex()),
            group: self.group,
            order: self.order,
            description: self.description.clone(),
            published: self.published,
            children,
        }
    }

    pub fn into_dto(self) -> DocDto {
        DocDto {
            id: self.id.to_hex(),
            title: self.title,
            slug: self.slug,
            path: self.path,
            parent_id: self.parent_id.map(|id| id.to_hex()),
            group: self.group,
            order: self.order,
            description: self.description,
            content: self.content,
            published: self.published,
            created_at: rfc3339(self.created_at).unwrap_or_default(),
            updated_at: rfc3339(self.updated_at).unwrap_or_default(),
        }
    }
}

/// Node used inside a docs tree. Content is omitted so the tree stays light;
/// fetch `/api/docs/page` for the body.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocSummaryDto {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub path: String,
    pub parent_id: Option<String>,
    pub group: bool,
    pub order: i32,
    pub description: String,
    pub published: bool,
    pub children: Vec<DocSummaryDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocBreadcrumbDto {
    pub title: String,
    pub path: String,
}

/// Full documentation page returned by the public detail endpoints.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocPageDto {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub path: String,
    pub parent_id: Option<String>,
    pub group: bool,
    pub order: i32,
    pub description: String,
    pub content: String,
    pub published: bool,
    pub children: Vec<DocSummaryDto>,
    pub breadcrumbs: Vec<DocBreadcrumbDto>,
}

/// Flat representation used by the CMS.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocDto {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub path: String,
    pub parent_id: Option<String>,
    pub group: bool,
    pub order: i32,
    pub description: String,
    pub content: String,
    pub published: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocCreateInput {
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
    #[serde(default)]
    pub group: Option<bool>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub published: Option<bool>,
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocUpdateInput {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    /// `Some(None)` means the client sent `"parentId": null` (move to root),
    /// while a missing field leaves the hierarchy untouched.
    #[serde(default, deserialize_with = "deserialize_double_option")]
    pub parent_id: Option<Option<String>>,
    #[serde(default)]
    pub group: Option<bool>,
    #[serde(default)]
    pub order: Option<i32>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub published: Option<bool>,
}

fn deserialize_double_option<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub username: String,
    pub password_hash: String,
    #[serde(default = "default_role")]
    pub role: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

fn default_role() -> String {
    "admin".to_string()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserDto {
    pub id: String,
    pub username: String,
    pub role: String,
}

impl UserDoc {
    pub fn into_dto(self) -> UserDto {
        UserDto {
            id: self.id.to_hex(),
            username: self.username,
            role: self.role,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct SiteSettings {
    pub site_name: String,
    pub tagline: String,
    pub hotline: String,
    pub email: String,
    pub address: String,
    pub facebook: String,
    pub youtube: String,
    pub footer_text: String,
    pub header_logo: String,
    pub footer_logo: String,
    pub favicon: String,
    pub og_image: String,
}

impl Default for SiteSettings {
    fn default() -> Self {
        Self {
            site_name: "WebDoc".to_string(),
            tagline: "Scientific publishing demo".to_string(),
            hotline: "0912 345 678".to_string(),
            email: "hello@example.com".to_string(),
            address: "1 Demo Street, Hanoi, Vietnam".to_string(),
            facebook: "https://facebook.com/example".to_string(),
            youtube: "https://youtube.com/@example".to_string(),
            footer_text: "WebDoc demo — for evaluation only. © 2026 WebDoc.".to_string(),
            header_logo: String::new(),
            footer_logo: String::new(),
            favicon: String::new(),
            og_image: String::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct SiteSettingsInput {
    pub site_name: Option<String>,
    pub tagline: Option<String>,
    pub hotline: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub facebook: Option<String>,
    pub youtube: Option<String>,
    pub footer_text: Option<String>,
    pub header_logo: Option<String>,
    pub footer_logo: Option<String>,
    pub favicon: Option<String>,
    pub og_image: Option<String>,
}

impl SiteSettings {
    pub fn apply(&mut self, input: SiteSettingsInput) {
        if let Some(value) = input.site_name {
            self.site_name = value;
        }
        if let Some(value) = input.tagline {
            self.tagline = value;
        }
        if let Some(value) = input.hotline {
            self.hotline = value;
        }
        if let Some(value) = input.email {
            self.email = value;
        }
        if let Some(value) = input.address {
            self.address = value;
        }
        if let Some(value) = input.facebook {
            self.facebook = value;
        }
        if let Some(value) = input.youtube {
            self.youtube = value;
        }
        if let Some(value) = input.footer_text {
            self.footer_text = value;
        }
        if let Some(value) = input.header_logo {
            self.header_logo = value;
        }
        if let Some(value) = input.footer_logo {
            self.footer_logo = value;
        }
        if let Some(value) = input.favicon {
            self.favicon = value;
        }
        if let Some(value) = input.og_image {
            self.og_image = value;
        }
    }
}

// ---------------------------------------------------------------------------
// Interface translations (i18n)
// ---------------------------------------------------------------------------

/// A locale stored in the `i18n` collection. `ui` and `admin` are flat maps of
/// message key to string; the key itself keeps its dots (for example
/// `nav.search`) because the whole map is always read and written at once.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct I18nDoc {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub code: String,
    pub name: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(rename = "isDefault", default)]
    pub is_default: bool,
    /// Whether the public site may offer this locale. Only ever true while
    /// `enabled` is true; independent from the CMS locale list.
    #[serde(rename = "uiEnabled", default = "default_enabled")]
    pub ui_enabled: bool,
    /// The locale preselected by the public site. Exactly one globally enabled
    /// and UI-enabled locale carries this flag; `isDefault` stays the CMS
    /// default.
    #[serde(rename = "uiDefault", default)]
    pub ui_default: bool,
    #[serde(default)]
    pub order: i32,
    #[serde(default)]
    pub ui: Document,
    #[serde(default)]
    pub admin: Document,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

fn default_enabled() -> bool {
    true
}

impl I18nDoc {
    pub fn into_dto(self) -> I18nAdminDto {
        I18nAdminDto {
            code: self.code,
            name: self.name,
            enabled: self.enabled,
            is_default: self.is_default,
            ui_enabled: self.ui_enabled,
            ui_default: self.ui_default,
            order: self.order,
            ui: self.ui,
            admin: self.admin,
            created_at: rfc3339(self.created_at),
            updated_at: rfc3339(self.updated_at),
        }
    }
}

/// Full locale document returned by the admin CMS.
#[derive(Debug, Clone, Serialize)]
pub struct I18nAdminDto {
    pub code: String,
    pub name: String,
    pub enabled: bool,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
    #[serde(rename = "uiEnabled")]
    pub ui_enabled: bool,
    #[serde(rename = "uiDefault")]
    pub ui_default: bool,
    pub order: i32,
    pub ui: Document,
    pub admin: Document,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct I18nLocaleDto {
    pub code: String,
    pub name: String,
    pub order: i32,
    pub ui_enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct I18nConfigDto {
    pub default_locale: String,
    pub ui_default_locale: String,
    pub locales: Vec<I18nLocaleDto>,
}

#[derive(Debug, Clone, Serialize)]
pub struct I18nMessagesDto {
    pub code: String,
    pub name: String,
    pub ui: Document,
    pub admin: Document,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct I18nCreateInput {
    #[serde(default)]
    pub code: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub ui: Option<Value>,
    #[serde(default)]
    pub admin: Option<Value>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(rename = "isDefault", default)]
    pub is_default: Option<bool>,
    #[serde(rename = "uiEnabled", default)]
    pub ui_enabled: Option<bool>,
    #[serde(rename = "uiDefault", default)]
    pub ui_default: Option<bool>,
    #[serde(default)]
    pub order: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct I18nUpdateInput {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub ui: Option<Value>,
    #[serde(default)]
    pub admin: Option<Value>,
    #[serde(default)]
    pub enabled: Option<bool>,
    #[serde(rename = "isDefault", default)]
    pub is_default: Option<bool>,
    #[serde(rename = "uiEnabled", default)]
    pub ui_enabled: Option<bool>,
    #[serde(rename = "uiDefault", default)]
    pub ui_default: Option<bool>,
    #[serde(default)]
    pub order: Option<i32>,
}

/// Locale codes are BCP 47-ish: a lowercase primary tag plus an optional
/// capitalised region (`en`, `vi`, `pt-BR`).
pub fn valid_locale_code(code: &str) -> bool {
    let bytes = code.as_bytes();
    match bytes.len() {
        2 => bytes[0].is_ascii_lowercase() && bytes[1].is_ascii_lowercase(),
        5 => {
            bytes[0].is_ascii_lowercase()
                && bytes[1].is_ascii_lowercase()
                && bytes[2] == b'-'
                && bytes[3].is_ascii_alphabetic()
                && bytes[4].is_ascii_alphabetic()
        }
        _ => false,
    }
}

/// Validate a flat message dictionary (`ui` or `admin`): a JSON object whose
/// values are all strings. Nested objects, arrays and numbers are rejected.
pub fn i18n_messages_document(value: &Value, field: &str) -> Result<Document, String> {
    let map = value
        .as_object()
        .ok_or_else(|| format!("{field} phải là một object gồm các cặp khoá/chuỗi."))?;

    let mut document = Document::new();
    for (key, value) in map {
        let text = value
            .as_str()
            .ok_or_else(|| format!("Giá trị của \"{key}\" trong {field} phải là chuỗi."))?;
        document.insert(key.clone(), Bson::String(text.to_string()));
    }
    Ok(document)
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

/// Validate and normalise a homepage layout document. Keeps `data` free-form so
/// the admin CMS can edit any section without a schema migration.
pub fn normalize_layout(input: &Value) -> Result<Value, String> {
    let object = input
        .as_object()
        .ok_or_else(|| "Layout phải là một object.".to_string())?;
    let raw_sections = object
        .get("sections")
        .ok_or_else(|| "Layout thiếu trường sections.".to_string())?
        .as_array()
        .ok_or_else(|| "Trường sections phải là một mảng.".to_string())?;

    let mut sections: Vec<Value> = Vec::with_capacity(raw_sections.len());
    for (index, item) in raw_sections.iter().enumerate() {
        let item = item
            .as_object()
            .ok_or_else(|| format!("Phần tử sections thứ {} phải là một object.", index + 1))?;
        let key = item
            .get("key")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|key| !key.is_empty())
            .ok_or_else(|| format!("Phần tử sections thứ {} thiếu key.", index + 1))?;
        let enabled = item.get("enabled").and_then(Value::as_bool).unwrap_or(true);
        let order = item
            .get("order")
            .and_then(Value::as_i64)
            .unwrap_or((index as i64) + 1);
        let data = item
            .get("data")
            .cloned()
            .unwrap_or_else(|| Value::Object(Map::new()));
        if !data.is_object() {
            return Err(format!("data của section \"{key}\" phải là một object."));
        }

        let mut section = Map::new();
        section.insert("key".to_string(), Value::String(key.to_string()));
        section.insert("enabled".to_string(), Value::Bool(enabled));
        section.insert("order".to_string(), Value::Number(order.into()));
        section.insert("data".to_string(), data);
        sections.push(Value::Object(section));
    }

    sections.sort_by_key(|section| {
        section
            .get("order")
            .and_then(Value::as_i64)
            .unwrap_or_default()
    });

    Ok(json!({ "slug": "home", "sections": sections }))
}

#[cfg(test)]
mod i18n_tests {
    use super::{i18n_messages_document, valid_locale_code};
    use mongodb::bson::Bson;
    use serde_json::json;

    #[test]
    fn locale_codes_follow_bcp47_shape() {
        for code in ["en", "vi", "pt-BR", "en-GB", "zh-cn"] {
            assert!(valid_locale_code(code), "{code} should be accepted");
        }
        for code in ["", "e", "EN", "en_US", "en-USA", "e1", "en-1", "fr-"] {
            assert!(!valid_locale_code(code), "{code} should be rejected");
        }
    }

    #[test]
    fn message_dictionaries_must_be_flat_strings() {
        let document = i18n_messages_document(&json!({ "nav.search": "Search", "a.b": "" }), "ui")
            .expect("flat map is valid");
        assert_eq!(document.len(), 2);
        assert_eq!(
            document.get("nav.search"),
            Some(&Bson::String("Search".to_string()))
        );

        assert!(i18n_messages_document(&json!(["x"]), "ui").is_err());
        assert!(i18n_messages_document(&json!({ "a": 1 }), "ui").is_err());
        assert!(i18n_messages_document(&json!({ "a": { "b": "c" } }), "ui").is_err());
        assert!(i18n_messages_document(&json!({ "a": null }), "admin").is_err());
    }
}
