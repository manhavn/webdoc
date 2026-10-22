use std::env;
use std::path::{Path, PathBuf};

/// Runtime configuration loaded from environment variables.
///
/// Every value has a development-friendly default so the API can be started
/// with `cargo run` right after a fresh checkout. The front-end builds are
/// embedded in the release binary; `UI_DIST` / `ADMIN_DIST` are optional
/// development overrides.
#[derive(Debug, Clone)]
pub struct Config {
    pub mongodb_uri: String,
    pub mongodb_db: String,
    pub host: String,
    pub port: u16,
    pub api_prefix: String,
    pub admin_prefix: String,
    pub jwt_secret: String,
    pub admin_username: String,
    pub admin_password: String,
    /// Portable data root used for daemon logs, PID files and default uploads.
    pub data_dir: PathBuf,
    pub upload_dir: PathBuf,
    /// True when `UPLOAD_DIR` (env) supplied an explicit upload directory.
    pub upload_dir_explicit: bool,
    /// Public UI response cache root and lifetime.
    pub cache_dir: PathBuf,
    pub cache_ttl_secs: u64,
    /// Seed demo content/admin on an empty database (default true).
    pub seed: bool,
    pub cors_origins: Vec<String>,
    /// Explicit `UI_DIST` override. The embedded build is used otherwise.
    pub ui_dist: Option<PathBuf>,
    /// Explicit `ADMIN_DIST` override. The embedded build is used otherwise.
    pub admin_dist: Option<PathBuf>,
}

impl Config {
    pub fn from_env() -> Self {
        let mut cors_origins = vec![
            "http://localhost:5173".to_string(),
            "http://localhost:5174".to_string(),
            "http://127.0.0.1:5173".to_string(),
            "http://127.0.0.1:5174".to_string(),
        ];
        if let Ok(extra) = env::var("CORS_ORIGINS") {
            for origin in extra.split(',').map(str::trim).filter(|o| !o.is_empty()) {
                if !cors_origins.iter().any(|existing| existing == origin) {
                    cors_origins.push(origin.to_string());
                }
            }
        }

        let data_dir = absolute_path(resolve_data_dir());
        let upload_env = env_path("UPLOAD_DIR");
        let upload_dir_explicit = upload_env.is_some();
        let upload_dir = upload_env.unwrap_or_else(|| data_dir.join("uploads"));
        let cache_dir = absolute_path(
            env_path("WEBDOC_CACHE_DIR").unwrap_or_else(|| PathBuf::from("/tmp/webdoc")),
        );
        let cache_ttl_secs = env::var("WEBDOC_CACHE_TTL_SECS")
            .ok()
            .and_then(|value| value.trim().parse::<u64>().ok())
            .filter(|value| *value > 0)
            .unwrap_or(120);
        // Demo content is opt-in. Core bootstrap (admin + i18n) always runs.
        let seed = env::var("WEBDOC_SEED")
            .ok()
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes" | "on"
                )
            })
            .unwrap_or(false);

        Self {
            mongodb_uri: env_or("MONGODB_URI", "mongodb://127.0.0.1:27017"),
            mongodb_db: env_or("MONGODB_DB", "webdoc"),
            host: env_or("WEBDOC_HOST", "127.0.0.1"),
            port: env_or("PORT", "18620").parse().unwrap_or(18620),
            api_prefix: normalize_prefix("API_PREFIX", "/api"),
            admin_prefix: normalize_prefix("ADMIN_PREFIX", "/admin"),
            jwt_secret: env_or("JWT_SECRET", "dev-secret-change-me"),
            admin_username: env_or("ADMIN_USERNAME", "admin"),
            admin_password: env_or("ADMIN_PASSWORD", "admin123"),
            data_dir,
            upload_dir,
            upload_dir_explicit,
            cache_dir,
            cache_ttl_secs,
            seed,
            cors_origins,
            ui_dist: env_path("UI_DIST"),
            admin_dist: env_path("ADMIN_DIST"),
        }
    }
}

/// Resolve the portable data root without relying on the current directory.
///
/// Order:
/// 1. `WEBDOC_DATA_DIR`
/// 2. `<exe_dir>/../data` when the portable package has a data dir
/// 3. `$XDG_DATA_HOME/webdoc` (or `~/.local/share/webdoc`)
pub fn resolve_data_dir() -> PathBuf {
    if let Some(dir) = env_path("WEBDOC_DATA_DIR") {
        return dir;
    }
    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            if let Some(package_root) = exe_dir.parent() {
                let data_dir = package_root.join("data");
                if data_dir.is_dir() {
                    return data_dir;
                }
            }
        }
    }
    xdg_data_home().join("webdoc")
}

/// Normalise a URL prefix supplied by env or CLI.
pub fn normalize_prefix_value(raw: &str, fallback: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed == "/" {
        return fallback.to_string();
    }
    if trimmed.starts_with('/') {
        trimmed.to_string()
    } else {
        format!("/{trimmed}")
    }
}

pub fn absolute_path(path: PathBuf) -> PathBuf {
    std::path::absolute(&path).unwrap_or(path)
}

fn xdg_data_home() -> PathBuf {
    if let Some(dir) = env_path("XDG_DATA_HOME") {
        return dir;
    }
    if let Some(home) = env_path("HOME") {
        return home.join(".local").join("share");
    }
    std::env::temp_dir().join("webdoc-data")
}

fn normalize_prefix(key: &str, fallback: &str) -> String {
    normalize_prefix_value(&env_or(key, fallback), fallback)
}

fn env_path(key: &str) -> Option<PathBuf> {
    env::var_os(key)
        .map(PathBuf::from)
        .filter(|value| !value.as_os_str().is_empty())
}

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

/// Project-relative front-end build used by debug builds when nothing is
/// embedded (plain `cargo run` checkout). Release binaries rely exclusively on
/// their embedded assets or an explicit `UI_DIST` / `ADMIN_DIST`.
pub fn dev_dist_dir(name: &str) -> Option<PathBuf> {
    #[cfg(not(debug_assertions))]
    {
        let _ = name;
        None
    }

    #[cfg(debug_assertions)]
    {
        let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .map(|root| root.join(name).join("dist"))
    }
}

/// True when `path` contains an `index.html`.
pub fn is_site_dir(path: &Path) -> bool {
    path.join("index.html").is_file()
}
