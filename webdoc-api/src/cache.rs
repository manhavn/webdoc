//! Short-lived on-disk cache for public UI GET responses.
//!
//! Each process gets a random run directory under `WEBDOC_CACHE_DIR`
//! (default `/tmp/webdoc`). Cached JSON is written as one file per
//! path+query, so a warm cache avoids re-querying MongoDB for roughly two
//! minutes. On startup every other run directory is removed, keeping only the
//! directory belonging to the current process.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use axum::body::{to_bytes, Body};
use axum::extract::{Request, State};
use axum::http::header::{HeaderName, HeaderValue, CONTENT_TYPE};
use axum::http::{Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sha2::{Digest, Sha256};
use uuid::Uuid;

const MAX_CACHE_BYTES: usize = 16 * 1024 * 1024;

pub struct ApiCache {
    dir: Option<PathBuf>,
    ttl: Duration,
    run_id: String,
}

impl ApiCache {
    pub fn new(base: PathBuf, ttl_secs: u64) -> Arc<Self> {
        let run_id = Uuid::new_v4().simple().to_string()[..12].to_string();
        let run_dir = base.join(&run_id);

        let dir = match fs::create_dir_all(&run_dir) {
            Ok(()) => {
                cleanup_old_runs(&base, &run_id);
                tracing::info!(
                    cache_dir = %run_dir.display(),
                    ttl_secs,
                    "API response cache ready"
                );
                Some(run_dir)
            }
            Err(error) => {
                tracing::warn!(
                    cache_dir = %run_dir.display(),
                    error = %error,
                    "API response cache disabled"
                );
                None
            }
        };

        Arc::new(Self {
            dir,
            ttl: Duration::from_secs(ttl_secs),
            run_id,
        })
    }

    fn path_for(&self, key: &str) -> Option<PathBuf> {
        let dir = self.dir.as_ref()?;
        let digest = Sha256::digest(key.as_bytes());
        let mut name = String::with_capacity(digest.len() * 2 + 5);
        for byte in digest {
            use std::fmt::Write;
            let _ = write!(name, "{byte:02x}");
        }
        name.push_str(".json");
        Some(dir.join(name))
    }

    async fn get(&self, key: &str) -> Option<Vec<u8>> {
        let path = self.path_for(key)?;
        let metadata = tokio::fs::metadata(&path).await.ok()?;
        let modified = metadata.modified().ok()?;
        let age = SystemTime::now()
            .duration_since(modified)
            .unwrap_or_default();
        if age > self.ttl {
            let _ = tokio::fs::remove_file(&path).await;
            return None;
        }
        match tokio::fs::read(&path).await {
            Ok(bytes)
                if bytes.len() <= MAX_CACHE_BYTES
                    && serde_json::from_slice::<serde_json::Value>(&bytes).is_ok() =>
            {
                Some(bytes)
            }
            Ok(_) => {
                let _ = tokio::fs::remove_file(&path).await;
                None
            }
            Err(_) => None,
        }
    }

    async fn put(&self, key: &str, body: &[u8]) {
        let Some(path) = self.path_for(key) else {
            return;
        };
        if body.len() > MAX_CACHE_BYTES {
            return;
        }
        let temp = path.with_extension(format!("tmp-{}", Uuid::new_v4().simple()));
        if let Err(error) = tokio::fs::write(&temp, body).await {
            tracing::warn!(file = %temp.display(), error = %error, "cannot write response cache");
            return;
        }
        if let Err(error) = tokio::fs::rename(&temp, &path).await {
            tracing::warn!(file = %path.display(), error = %error, "cannot commit response cache");
            let _ = tokio::fs::remove_file(&temp).await;
        }
    }

    /// Drop every entry for this run. Called after successful CMS writes so
    /// the public UI never serves stale configuration for up to the full TTL.
    pub async fn clear(&self) {
        let Some(dir) = self.dir.as_ref() else {
            return;
        };
        let mut entries = match tokio::fs::read_dir(dir).await {
            Ok(entries) => entries,
            Err(_) => return,
        };
        while let Ok(Some(entry)) = entries.next_entry().await {
            let Ok(file_type) = entry.file_type().await else {
                continue;
            };
            if file_type.is_file() {
                let _ = tokio::fs::remove_file(entry.path()).await;
            }
        }
    }

    pub fn run_id(&self) -> &str {
        &self.run_id
    }
}

fn cleanup_old_runs(base: &Path, current: &str) {
    let Ok(entries) = fs::read_dir(base) else {
        return;
    };
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name == current {
            continue;
        }
        if let Err(error) = fs::remove_dir_all(entry.path()) {
            tracing::warn!(dir = %entry.path().display(), error = %error, "cannot remove old response cache");
        }
    }
}

/// Cache successful public GET JSON responses. Requests are keyed by the
/// complete path + query string, so `/docs/page?path=a` and `?path=b` never
/// share an entry.
/// Invalidate the public cache after any successful CMS mutation.
pub async fn invalidate_on_write(
    State(cache): State<Arc<ApiCache>>,
    request: Request,
    next: Next,
) -> Response {
    let write = !matches!(
        request.method(),
        &Method::GET | &Method::HEAD | &Method::OPTIONS
    );
    let response = next.run(request).await;
    if write && response.status().is_success() {
        cache.clear().await;
    }
    response
}

pub async fn public_cache(
    State(cache): State<Arc<ApiCache>>,
    request: Request,
    next: Next,
) -> Response {
    if request.method() != Method::GET {
        return next.run(request).await;
    }
    // Health checks are cheap; the CMS and auth endpoints must never be
    // served from a shared response cache.
    let path = request.uri().path();
    if path == "/health"
        || path == "/admin"
        || path.starts_with("/admin/")
        || path == "/auth"
        || path.starts_with("/auth/")
    {
        return next.run(request).await;
    }

    let key = request
        .uri()
        .path_and_query()
        .map(|value| value.as_str())
        .unwrap_or_else(|| request.uri().path())
        .to_string();
    if let Some(bytes) = cache.get(&key).await {
        let mut response = Response::new(Body::from(bytes));
        response.headers_mut().insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/json; charset=utf-8"),
        );
        response.headers_mut().insert(
            HeaderName::from_static("x-webdoc-cache"),
            HeaderValue::from_static("hit"),
        );
        return response;
    }

    let response = next.run(request).await;
    if response.status() != StatusCode::OK {
        return response;
    }
    let is_json = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("application/json"));
    if !is_json {
        return response;
    }

    let (parts, body) = response.into_parts();
    let bytes = match to_bytes(body, MAX_CACHE_BYTES).await {
        Ok(bytes) => bytes,
        Err(error) => {
            tracing::error!(error = %error, "failed to buffer public response for cache");
            return StatusCode::INTERNAL_SERVER_ERROR.into_response();
        }
    };
    // Only persist a successful, valid JSON response. Errors, 404s and empty
    // bodies must never poison the cache with a "missing" result.
    if serde_json::from_slice::<serde_json::Value>(&bytes).is_err() {
        tracing::warn!(key = %key, "skipping response cache: invalid JSON");
        return Response::from_parts(parts, Body::from(bytes));
    }
    cache.put(&key, &bytes).await;
    let mut response = Response::from_parts(parts, Body::from(bytes));
    response.headers_mut().insert(
        HeaderName::from_static("x-webdoc-cache"),
        HeaderValue::from_static("miss"),
    );
    response
}
