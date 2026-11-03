use mongodb::bson::{oid::ObjectId, Bson, DateTime, Document};
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    /// Treat group nodes as containers only: navigation opens their first
    /// article instead of the group page.
    #[serde(default)]
    pub docs_skip_groups: bool,
    #[serde(default)]
    pub skip_homepage: bool,
    #[serde(default)]
    pub docs_accordion: bool,
}

impl Default for SiteSettings {
    fn default() -> Self {
        Self {
            site_name: "WebDoc Demo".to_string(),
            tagline: "Fictional sample content for product evaluation".to_string(),
            hotline: "0000 0000".to_string(),
            email: "hello@example.com".to_string(),
            address: "100 Example Avenue, Sample City".to_string(),
            facebook: "https://example.com/community".to_string(),
            youtube: String::new(),
            footer_text: "Demo content for evaluation only. © 2026 WebDoc Demo.".to_string(),
            header_logo: String::new(),
            footer_logo: String::new(),
            favicon: String::new(),
            og_image: String::new(),
            docs_skip_groups: false,
            skip_homepage: false,
            docs_accordion: false,
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
    pub docs_skip_groups: Option<bool>,
    pub skip_homepage: Option<bool>,
    pub docs_accordion: Option<bool>,
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
        if let Some(value) = input.docs_skip_groups {
            self.docs_skip_groups = value;
        }
        if let Some(value) = input.skip_homepage {
            self.skip_homepage = value;
        }
        if let Some(value) = input.docs_accordion {
            self.docs_accordion = value;
        }
    }
}
// ---------------------------------------------------------------------------
// CMS appearance and enterprise branding settings
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CmsColors {
    pub primary: String,
    pub primary_dark: String,
    pub accent_dark: String,
    pub sidebar_bg: String,
    pub sidebar_text: String,
    pub topbar_bg: String,
    pub topbar_text: String,
    pub login_panel_bg: String,
}

impl Default for CmsColors {
    fn default() -> Self {
        Self {
            primary: "#0f766e".to_string(),
            primary_dark: "#115e59".to_string(),
            accent_dark: "#2dd4bf".to_string(),
            sidebar_bg: "#ffffff".to_string(),
            sidebar_text: "#0f172a".to_string(),
            topbar_bg: "#ffffff".to_string(),
            topbar_text: "#0f172a".to_string(),
            login_panel_bg: String::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CmsColorsInput {
    pub primary: Option<String>,
    pub primary_dark: Option<String>,
    pub accent_dark: Option<String>,
    pub sidebar_bg: Option<String>,
    pub sidebar_text: Option<String>,
    pub topbar_bg: Option<String>,
    pub topbar_text: Option<String>,
    pub login_panel_bg: Option<String>,
}

impl CmsColors {
    pub fn apply(&mut self, input: CmsColorsInput) {
        if let Some(v) = input.primary {
            self.primary = v;
        }
        if let Some(v) = input.primary_dark {
            self.primary_dark = v;
        }
        if let Some(v) = input.accent_dark {
            self.accent_dark = v;
        }
        if let Some(v) = input.sidebar_bg {
            self.sidebar_bg = v;
        }
        if let Some(v) = input.sidebar_text {
            self.sidebar_text = v;
        }
        if let Some(v) = input.topbar_bg {
            self.topbar_bg = v;
        }
        if let Some(v) = input.topbar_text {
            self.topbar_text = v;
        }
        if let Some(v) = input.login_panel_bg {
            self.login_panel_bg = v;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct CmsSettings {
    pub brand_name: String,
    pub brand_subname: String,
    pub logo_url: String,
    pub logo_char: String,
    pub favicon: String,
    pub login_title: String,
    pub login_subtitle: String,
    pub login_welcome: String,
    pub login_description: String,
    pub footer_text: String,
    pub colors: CmsColors,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub login_panel_bg: String,
}

impl Default for CmsSettings {
    fn default() -> Self {
        Self {
            brand_name: "WebDoc Demo".to_string(),
            brand_subname: "Admin console".to_string(),
            logo_url: String::new(),
            logo_char: "O".to_string(),
            favicon: String::new(),
            login_title: "Sign in".to_string(),
            login_subtitle: "Please sign in with an administrator account.".to_string(),
            login_welcome: "Run your website with confidence".to_string(),
            login_description: "Manage the content tree, homepage HTML and site settings in a single interface.".to_string(),
            footer_text: String::new(),
            colors: CmsColors::default(),
            login_panel_bg: String::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct CmsSettingsInput {
    pub brand_name: Option<String>,
    pub brand_subname: Option<String>,
    pub logo_url: Option<String>,
    pub logo_char: Option<String>,
    pub favicon: Option<String>,
    pub login_title: Option<String>,
    pub login_subtitle: Option<String>,
    pub login_welcome: Option<String>,
    pub login_description: Option<String>,
    pub footer_text: Option<String>,
    pub colors: Option<CmsColorsInput>,
    pub login_panel_bg: Option<String>,
}

impl CmsSettings {
    pub fn apply(&mut self, input: CmsSettingsInput) {
        if let Some(v) = input.brand_name {
            self.brand_name = v;
        }
        if let Some(v) = input.brand_subname {
            self.brand_subname = v;
        }
        if let Some(v) = input.logo_url {
            self.logo_url = v;
        }
        if let Some(v) = input.logo_char {
            self.logo_char = v;
        }
        if let Some(v) = input.favicon {
            self.favicon = v;
        }
        if let Some(v) = input.login_title {
            self.login_title = v;
        }
        if let Some(v) = input.login_subtitle {
            self.login_subtitle = v;
        }
        if let Some(v) = input.login_welcome {
            self.login_welcome = v;
        }
        if let Some(v) = input.login_description {
            self.login_description = v;
        }
        if let Some(v) = input.footer_text {
            self.footer_text = v;
        }
        if let Some(colors_input) = input.colors {
            self.colors.apply(colors_input);
            self.login_panel_bg = self.colors.login_panel_bg.clone();
        }
        if let Some(v) = input.login_panel_bg {
            self.colors.login_panel_bg = v.clone();
            self.login_panel_bg = v;
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

    #[test]
    fn site_settings_deserializes_with_id_and_key() {
        use mongodb::bson::doc;
        let d = doc! {
            "_id": mongodb::bson::oid::ObjectId::new(),
            "key": "site",
            "siteName": "My Custom Site"
        };
        let s: super::SiteSettings = mongodb::bson::from_document(d).unwrap();
        assert_eq!(s.site_name, "My Custom Site");
    }

    #[test]
    fn cms_settings_deserializes_with_id_and_key() {
        use mongodb::bson::doc;
        let d = doc! {
            "_id": mongodb::bson::oid::ObjectId::new(),
            "key": "cms",
            "brandName": "My Custom CMS"
        };
        let s: super::CmsSettings = mongodb::bson::from_document(d).unwrap();
        assert_eq!(s.brand_name, "My Custom CMS");
    }

    #[test]
    fn cms_settings_supports_login_panel_bg() {
        use mongodb::bson::doc;
        let d = doc! {
            "brandName": "My Custom CMS",
            "colors": {
                "loginPanelBg": "linear-gradient(150deg, #1e3a8a 0%, #3b82f6 100%)"
            }
        };
        let mut s: super::CmsSettings = mongodb::bson::from_document(d).unwrap();
        assert_eq!(
            s.colors.login_panel_bg,
            "linear-gradient(150deg, #1e3a8a 0%, #3b82f6 100%)"
        );

        let input = super::CmsSettingsInput {
            login_panel_bg: Some("#112233".to_string()),
            ..Default::default()
        };
        s.apply(input);
        assert_eq!(s.colors.login_panel_bg, "#112233");
        assert_eq!(s.login_panel_bg, "#112233");
    }
}
