//! Static front-end hosting with content-based ETags.
//!
//! Both the public site and the CMS are embedded into the release binary with
//! `rust-embed`. During development an explicit `UI_DIST` / `ADMIN_DIST`
//! directory (or the sibling `dist` folder of a debug build) is preferred so
//! `cargo run` keeps working without rebuilding the binary.
//!
//! The same handler serves embedded and on-disk assets, which keeps caching,
//! MIME detection and SPA fallbacks identical in both modes.

use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::http::header::{
    HeaderMap, HeaderValue, CACHE_CONTROL, CONTENT_TYPE, ETAG, X_CONTENT_TYPE_OPTIONS,
};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use rust_embed::{EmbeddedFile, RustEmbed};

use crate::config::{self, Config};
use crate::http_cache;

#[derive(RustEmbed)]
#[folder = "embed/ui"]
struct UiEmbed;

#[derive(RustEmbed)]
#[folder = "embed/admin"]
struct AdminEmbed;

#[derive(Clone)]
struct AssetMeta {
    etag: String,
    mime: &'static str,
}

enum Source {
    Embedded(fn(&str) -> Option<EmbeddedFile>),
    Directory(PathBuf),
}

pub struct SiteAssets {
    label: &'static str,
    source: Source,
    embedded_meta: HashMap<String, AssetMeta>,
}

impl SiteAssets {
    /// Resolve the public site build: explicit `UI_DIST`, then the embedded
    /// copy, then (debug builds only) `../webdoc-ui/dist`.
    pub fn resolve_ui(config: &Config) -> Option<Self> {
        resolve(
            "ui",
            config.ui_dist.as_deref(),
            "UI_DIST",
            ui_get,
            ui_paths,
            "webdoc-ui",
        )
    }

    /// Resolve the CMS build: explicit `ADMIN_DIST`, then the embedded copy,
    /// then (debug builds only) `../webdoc-admin/dist`.
    pub fn resolve_admin(config: &Config) -> Option<Self> {
        resolve(
            "admin",
            config.admin_dist.as_deref(),
            "ADMIN_DIST",
            admin_get,
            admin_paths,
            "webdoc-admin",
        )
    }

    pub fn label(&self) -> &'static str {
        self.label
    }

    fn from_embedded(
        label: &'static str,
        get: fn(&str) -> Option<EmbeddedFile>,
        paths: fn() -> Vec<String>,
    ) -> Option<Self> {
        get("index.html")?;

        let mut embedded_meta = HashMap::new();
        for path in paths() {
            if let Some(file) = get(&path) {
                embedded_meta.insert(
                    path.clone(),
                    AssetMeta {
                        etag: http_cache::strong_etag(&file.data),
                        mime: mime_for(&path),
                    },
                );
            }
        }

        Some(Self {
            label,
            source: Source::Embedded(get),
            embedded_meta,
        })
    }

    fn from_directory(label: &'static str, path: PathBuf) -> Option<Self> {
        if !config::is_site_dir(&path) {
            return None;
        }
        Some(Self {
            label,
            source: Source::Directory(path),
            embedded_meta: HashMap::new(),
        })
    }

    async fn meta(&self, relative: &str) -> Option<AssetMeta> {
        if !is_safe_relative(relative) {
            return None;
        }
        match &self.source {
            Source::Embedded(_) => self.embedded_meta.get(relative).cloned(),
            Source::Directory(root) => {
                let metadata = tokio::fs::metadata(root.join(relative)).await.ok()?;
                if !metadata.is_file() {
                    return None;
                }
                Some(AssetMeta {
                    etag: metadata_etag(&metadata),
                    mime: mime_for(relative),
                })
            }
        }
    }

    async fn read(&self, relative: &str) -> Option<Vec<u8>> {
        if !is_safe_relative(relative) {
            return None;
        }
        match &self.source {
            Source::Embedded(get) => get(relative).map(|file| file.data.into_owned()),
            Source::Directory(root) => tokio::fs::read(root.join(relative)).await.ok(),
        }
    }
}

fn resolve(
    label: &'static str,
    explicit: Option<&Path>,
    env_name: &str,
    get: fn(&str) -> Option<EmbeddedFile>,
    paths: fn() -> Vec<String>,
    dev_name: &str,
) -> Option<SiteAssets> {
    if let Some(path) = explicit {
        if config::is_site_dir(path) {
            tracing::info!(path = %path.display(), "Serving {label} from {env_name}");
            return SiteAssets::from_directory(label, path.to_path_buf());
        }
        tracing::warn!(
            path = %path.display(),
            "Skipping {env_name}: index.html not found"
        );
    }

    if let Some(assets) = SiteAssets::from_embedded(label, get, paths) {
        tracing::info!("Serving {label} from embedded assets");
        return Some(assets);
    }

    if let Some(path) = config::dev_dist_dir(dev_name) {
        if config::is_site_dir(&path) {
            tracing::info!(path = %path.display(), "Serving {label} from development build");
            return SiteAssets::from_directory(label, path);
        }
    }

    tracing::warn!("No {label} build found (embedded assets are empty)");
    None
}

fn ui_get(path: &str) -> Option<EmbeddedFile> {
    UiEmbed::get(path)
}

fn ui_paths() -> Vec<String> {
    UiEmbed::iter().map(|path| path.into_owned()).collect()
}

fn admin_get(path: &str) -> Option<EmbeddedFile> {
    AdminEmbed::get(path)
}

fn admin_paths() -> Vec<String> {
    AdminEmbed::iter().map(|path| path.into_owned()).collect()
}

fn is_safe_relative(relative: &str) -> bool {
    !relative.is_empty()
        && !relative.starts_with('/')
        && !relative.contains('\\')
        && Path::new(relative)
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

pub(crate) fn metadata_etag(metadata: &std::fs::Metadata) -> String {
    let len = metadata.len();
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("\"{len:x}-{modified:x}\"")
}

pub(crate) fn mime_for(path: &str) -> &'static str {
    let extension = path
        .rsplit('/')
        .next()
        .and_then(|name| name.rsplit_once('.'))
        .map(|(_, extension)| extension)
        .unwrap_or_default();

    if extension.eq_ignore_ascii_case("html") || extension.eq_ignore_ascii_case("htm") {
        "text/html; charset=utf-8"
    } else if extension.eq_ignore_ascii_case("js") || extension.eq_ignore_ascii_case("mjs") {
        "text/javascript; charset=utf-8"
    } else if extension.eq_ignore_ascii_case("css") {
        "text/css; charset=utf-8"
    } else if extension.eq_ignore_ascii_case("json") || extension.eq_ignore_ascii_case("map") {
        "application/json"
    } else if extension.eq_ignore_ascii_case("svg") {
        "image/svg+xml"
    } else if extension.eq_ignore_ascii_case("png") {
        "image/png"
    } else if extension.eq_ignore_ascii_case("jpg") || extension.eq_ignore_ascii_case("jpeg") {
        "image/jpeg"
    } else if extension.eq_ignore_ascii_case("webp") {
        "image/webp"
    } else if extension.eq_ignore_ascii_case("gif") {
        "image/gif"
    } else if extension.eq_ignore_ascii_case("ico") {
        "image/x-icon"
    } else if extension.eq_ignore_ascii_case("woff2") {
        "font/woff2"
    } else if extension.eq_ignore_ascii_case("woff") {
        "font/woff"
    } else if extension.eq_ignore_ascii_case("ttf") {
        "font/ttf"
    } else if extension.eq_ignore_ascii_case("otf") {
        "font/otf"
    } else if extension.eq_ignore_ascii_case("txt") {
        "text/plain; charset=utf-8"
    } else if extension.eq_ignore_ascii_case("xml") {
        "application/xml"
    } else if extension.eq_ignore_ascii_case("pdf") {
        "application/pdf"
    } else if extension.eq_ignore_ascii_case("wasm") {
        "application/wasm"
    } else if extension.eq_ignore_ascii_case("mp4") {
        "video/mp4"
    } else if extension.eq_ignore_ascii_case("webm") {
        "video/webm"
    } else {
        "application/octet-stream"
    }
}

/// Cache policy: hashed Vite assets are immutable, the HTML shell must be
/// revalidated, and other files get a short public cache.
fn cache_control(path: &str) -> &'static str {
    if path == "index.html" {
        "no-cache"
    } else if is_hashed_asset(path) {
        "public, max-age=31536000, immutable"
    } else {
        "public, max-age=3600"
    }
}

/// Vite appends an 8-character base64url hash to emitted files
/// (`index-LSr4l-Ln.js`, `inter-roman-greek-ext.CqjqNYQ-.woff2`). The hash can
/// itself contain `-`, so inspect the final 8 characters rather than splitting
/// on separators. Files copied verbatim from `public/` (for example
/// `assets/theme.css` or `assets/yt/lite-yt-embed.js`) are not hashed and must
/// stay revalidated.
fn is_hashed_asset(path: &str) -> bool {
    if !path.starts_with("assets/") {
        return false;
    }
    let name = path.rsplit('/').next().unwrap_or(path);
    let Some(stem) = name.rsplit_once('.').map(|(stem, _)| stem) else {
        return false;
    };
    let bytes = stem.as_bytes();
    if bytes.len() < 9 {
        return false;
    }
    let separator = bytes[bytes.len() - 9];
    if separator != b'-' && separator != b'.' {
        return false;
    }
    let hash = &bytes[bytes.len() - 8..];
    let valid = hash
        .iter()
        .all(|byte| byte.is_ascii_alphanumeric() || *byte == b'_' || *byte == b'-');
    // Pure lowercase words such as `yt-embed` are not Vite hashes.
    let mixed = hash
        .iter()
        .any(|byte| byte.is_ascii_digit() || byte.is_ascii_uppercase());
    valid && mixed
}

fn not_found() -> Response {
    let mut response = (StatusCode::NOT_FOUND, "Not found").into_response();
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    response
}

/// Serve one file (or the SPA shell) from a resolved build.
pub async fn serve(assets: &SiteAssets, request_path: &str, headers: &HeaderMap) -> Response {
    let trimmed = request_path.trim_start_matches('/').trim_end_matches('/');

    if !trimmed.is_empty() && !is_safe_relative(trimmed) {
        return not_found();
    }

    let candidate = assets.meta(trimmed).await;
    let relative = match candidate {
        Some(meta) => {
            return respond(assets, trimmed, meta, headers).await;
        }
        None if trimmed.is_empty() || !trimmed.rsplit('/').next().unwrap_or("").contains('.') => {
            "index.html"
        }
        None => return not_found(),
    };

    let Some(meta) = assets.meta(relative).await else {
        tracing::error!(file = relative, "SPA shell missing from static build");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            "Static build is incomplete",
        )
            .into_response();
    };
    respond(assets, relative, meta, headers).await
}

async fn respond(
    assets: &SiteAssets,
    relative: &str,
    meta: AssetMeta,
    headers: &HeaderMap,
) -> Response {
    let mut response = if http_cache::if_none_match(headers, &meta.etag) {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::NOT_MODIFIED;
        response
    } else {
        let Some(body) = assets.read(relative).await else {
            tracing::error!(file = relative, "Static file disappeared while serving");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Static build is incomplete",
            )
                .into_response();
        };
        let mut response = Response::new(Body::from(body));
        response
            .headers_mut()
            .insert(CONTENT_TYPE, HeaderValue::from_static(meta.mime));
        response
    };

    let response_headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&meta.etag) {
        response_headers.insert(ETAG, value);
    }
    response_headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static(cache_control(relative)),
    );
    response_headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    response
}
