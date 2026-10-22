//! Startup data migrations.
//!
//! Locales gained two public-UI fields (`uiEnabled`, `uiDefault`) that are
//! independent from the CMS-wide `enabled` / `isDefault` flags. Documents
//! written by older releases do not have them, so they are backfilled from the
//! existing flags and then repaired so the public site always has exactly one
//! visible default locale.

use futures_util::TryStreamExt;
use mongodb::bson::{doc, Bson, Document};
use mongodb::Database;

use crate::routes::i18n::COLLECTION;

fn int_field(document: &Document, key: &str) -> i32 {
    match document.get(key) {
        Some(Bson::Int32(value)) => *value,
        Some(Bson::Int64(value)) => *value as i32,
        Some(Bson::Double(value)) => *value as i32,
        _ => 0,
    }
}

/// The persisted locale fields the migration needs.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UiFlag {
    pub code: String,
    pub order: i32,
    pub enabled: bool,
    pub ui_enabled: bool,
    pub ui_default: bool,
}

/// Changes the migration must apply to satisfy the public-UI invariants.
#[derive(Debug, Default, PartialEq, Eq)]
pub struct UiRepair {
    /// Locale to force to `enabled: true, uiEnabled: true` because no locale
    /// was visible to the public site at all.
    pub enable: Option<String>,
    /// Locale that must end up as the single `uiDefault`.
    pub default: Option<String>,
    /// Locales whose stale `uiDefault` must be cleared.
    pub clear: Vec<String>,
}

/// Work out the minimal repair for a set of locales.
///
/// Rules: only `enabled && uiEnabled` locales may be a UI default; there is
/// exactly one UI default; when it is missing the lowest ordered visible
/// locale is chosen, preferring `en`; when several carry the flag `en` wins,
/// otherwise the lowest ordered one.
pub fn plan_ui_repair(flags: &[UiFlag]) -> UiRepair {
    let mut repair = UiRepair::default();
    let ordered = |items: &mut Vec<&UiFlag>| {
        items.sort_by(|left, right| {
            (left.order, left.code.as_str()).cmp(&(right.order, right.code.as_str()))
        });
    };

    let mut visible: Vec<&UiFlag> = flags
        .iter()
        .filter(|locale| locale.enabled && locale.ui_enabled)
        .collect();

    if visible.is_empty() {
        // Nothing is visible: re-enable `en` when it exists, otherwise the
        // first locale by order, and make it the visible default.
        let mut all: Vec<&UiFlag> = flags.iter().collect();
        ordered(&mut all);
        let target = all
            .iter()
            .find(|locale| locale.code == "en")
            .or_else(|| all.first())
            .map(|locale| locale.code.clone());
        if let Some(target) = target {
            repair.clear = flags
                .iter()
                .filter(|locale| locale.ui_default && locale.code != target)
                .map(|locale| locale.code.clone())
                .collect();
            repair.enable = Some(target.clone());
            repair.default = Some(target);
        }
        return repair;
    }

    ordered(&mut visible);

    // A default on a hidden/disabled locale cannot be served publicly.
    repair.clear = flags
        .iter()
        .filter(|locale| locale.ui_default && !(locale.enabled && locale.ui_enabled))
        .map(|locale| locale.code.clone())
        .collect();

    let mut defaults: Vec<&UiFlag> = visible
        .iter()
        .copied()
        .filter(|locale| locale.ui_default)
        .collect();
    ordered(&mut defaults);

    let chosen = if defaults.len() == 1 {
        defaults[0].code.clone()
    } else {
        let pool = if defaults.is_empty() {
            &visible
        } else {
            &defaults
        };
        pool.iter()
            .find(|locale| locale.code == "en")
            .or_else(|| pool.first())
            .map(|locale| locale.code.clone())
            .expect("non-empty visible locale list")
    };

    for locale in flags
        .iter()
        .filter(|locale| locale.ui_default && locale.code != chosen)
    {
        repair.clear.push(locale.code.clone());
    }
    repair.clear.sort();
    repair.clear.dedup();
    repair.default = Some(chosen);

    repair
}

/// Backfill and repair the public-UI fields of every locale. Idempotent and
/// intentionally cheap: the repair only writes when an invariant is broken.
pub async fn i18n_ui(db: &Database) -> mongodb::error::Result<()> {
    let collection = db.collection::<Document>(COLLECTION);

    // Documents created before the split simply inherit the CMS flags.
    collection
        .update_many(
            doc! { "uiEnabled": { "$exists": false } },
            vec![doc! { "$set": { "uiEnabled": { "$ifNull": ["$enabled", true] } } }],
        )
        .await?;
    collection
        .update_many(
            doc! { "uiDefault": { "$exists": false } },
            vec![doc! { "$set": { "uiDefault": { "$ifNull": ["$isDefault", false] } } }],
        )
        .await?;
    // A globally disabled locale can never stay visible.
    collection
        .update_many(
            doc! { "enabled": false, "uiEnabled": true },
            doc! { "$set": { "uiEnabled": false } },
        )
        .await?;

    let mut cursor = collection
        .find(doc! {})
        .sort(doc! { "order": 1, "name": 1 })
        .await?;
    let mut flags = Vec::new();
    while let Some(document) = cursor.try_next().await? {
        let Ok(code) = document.get_str("code") else {
            continue;
        };
        flags.push(UiFlag {
            code: code.to_string(),
            order: int_field(&document, "order"),
            enabled: document.get_bool("enabled").unwrap_or(true),
            ui_enabled: document.get_bool("uiEnabled").unwrap_or(true),
            ui_default: document.get_bool("uiDefault").unwrap_or(false),
        });
    }
    if flags.is_empty() {
        return Ok(());
    }

    let repair = plan_ui_repair(&flags);
    if let Some(code) = &repair.enable {
        collection
            .update_one(
                doc! { "code": code },
                doc! { "$set": { "enabled": true, "uiEnabled": true } },
            )
            .await?;
    }
    if !repair.clear.is_empty() {
        collection
            .update_many(
                doc! {
                    "code": {
                        "$in": repair
                            .clear
                            .iter()
                            .cloned()
                            .map(Bson::String)
                            .collect::<Vec<_>>()
                    },
                    "uiDefault": true,
                },
                doc! { "$set": { "uiDefault": false } },
            )
            .await?;
    }
    if let Some(code) = &repair.default {
        let already = flags
            .iter()
            .any(|locale| &locale.code == code && locale.ui_default);
        if !already {
            collection
                .update_one(
                    doc! { "code": code },
                    doc! { "$set": { "uiDefault": true } },
                )
                .await?;
        }
        if !already || repair.enable.is_some() || !repair.clear.is_empty() {
            tracing::info!(
                ui_default = %code,
                ui_enabled = ?repair.enable,
                cleared = ?repair.clear,
                "Repaired public-UI locale configuration"
            );
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{plan_ui_repair, UiFlag};

    fn flag(code: &str, order: i32, enabled: bool, ui_enabled: bool, ui_default: bool) -> UiFlag {
        UiFlag {
            code: code.to_string(),
            order,
            enabled,
            ui_enabled,
            ui_default,
        }
    }

    #[test]
    fn old_documents_inherit_the_cms_flags() {
        let repair = plan_ui_repair(&[
            flag("en", 1, true, true, true),
            flag("vi", 2, true, true, false),
        ]);
        assert_eq!(repair.enable, None);
        assert_eq!(repair.default.as_deref(), Some("en"));
        assert!(repair.clear.is_empty());
    }

    #[test]
    fn missing_default_prefers_english() {
        let repair = plan_ui_repair(&[
            flag("vi", 1, true, true, false),
            flag("en", 2, true, true, false),
        ]);
        assert_eq!(repair.default.as_deref(), Some("en"));
        assert!(repair.clear.is_empty());
    }

    #[test]
    fn missing_default_falls_back_to_lowest_order() {
        let repair = plan_ui_repair(&[
            flag("fr", 3, true, true, false),
            flag("vi", 2, true, true, false),
        ]);
        assert_eq!(repair.default.as_deref(), Some("vi"));
    }

    #[test]
    fn multiple_defaults_keep_english() {
        let repair = plan_ui_repair(&[
            flag("vi", 1, true, true, true),
            flag("en", 2, true, true, true),
            flag("fr", 3, true, true, false),
        ]);
        assert_eq!(repair.default.as_deref(), Some("en"));
        assert_eq!(repair.clear, vec!["vi".to_string()]);
    }

    #[test]
    fn multiple_defaults_without_english_keep_the_first() {
        let repair = plan_ui_repair(&[
            flag("fr", 2, true, true, true),
            flag("vi", 1, true, true, true),
        ]);
        assert_eq!(repair.default.as_deref(), Some("vi"));
        assert_eq!(repair.clear, vec!["fr".to_string()]);
    }

    #[test]
    fn hidden_defaults_are_replaced() {
        let repair = plan_ui_repair(&[
            flag("en", 1, true, false, true),
            flag("vi", 2, true, true, false),
        ]);
        assert_eq!(repair.default.as_deref(), Some("vi"));
        assert_eq!(repair.clear, vec!["en".to_string()]);
    }

    #[test]
    fn disabled_defaults_are_replaced() {
        let repair = plan_ui_repair(&[
            flag("en", 1, false, true, true),
            flag("fr", 3, true, true, false),
            flag("vi", 2, true, true, false),
        ]);
        assert_eq!(repair.default.as_deref(), Some("vi"));
        assert_eq!(repair.clear, vec!["en".to_string()]);
    }

    #[test]
    fn no_visible_locale_reenables_english() {
        let repair = plan_ui_repair(&[
            flag("en", 1, false, false, false),
            flag("vi", 2, true, false, true),
        ]);
        assert_eq!(repair.enable.as_deref(), Some("en"));
        assert_eq!(repair.default.as_deref(), Some("en"));
        assert_eq!(repair.clear, vec!["vi".to_string()]);
    }

    #[test]
    fn no_visible_locale_without_english_uses_the_first() {
        let repair = plan_ui_repair(&[
            flag("fr", 3, true, false, false),
            flag("vi", 2, false, true, false),
        ]);
        assert_eq!(repair.enable.as_deref(), Some("vi"));
        assert_eq!(repair.default.as_deref(), Some("vi"));
        assert!(repair.clear.is_empty());
    }

    #[test]
    fn single_visible_default_is_kept() {
        let repair = plan_ui_repair(&[
            flag("en", 1, true, false, false),
            flag("vi", 2, true, true, true),
        ]);
        assert_eq!(repair.default.as_deref(), Some("vi"));
        assert_eq!(repair.enable, None);
        assert!(repair.clear.is_empty());
    }
}
