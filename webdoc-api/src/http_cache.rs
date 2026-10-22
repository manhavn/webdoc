//! ETag support for JSON API responses.
//!
//! Only successful `GET` responses with a JSON body are buffered and hashed.
//! Uploads, ZIP exports and every non-GET request are left untouched so
//! streaming behaviour never changes.

use axum::body::{to_bytes, Body};
use axum::extract::Request;
use axum::http::header::{CACHE_CONTROL, CONTENT_LENGTH, CONTENT_TYPE, ETAG, IF_NONE_MATCH, VARY};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use sha2::{Digest, Sha256};

use crate::error::ApiError;

/// Upper bound for buffered JSON responses (admin docs list can be a few MB).
const MAX_JSON_BYTES: usize = 64 * 1024 * 1024;

/// Strong ETag (quoted SHA-256 hex) for a response body.
pub fn strong_etag(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut tag = String::with_capacity(66);
    tag.push('"');
    for byte in digest {
        use std::fmt::Write;
        let _ = write!(tag, "{byte:02x}");
    }
    tag.push('"');
    tag
}

/// Weak comparison of an `If-None-Match` header against our strong ETag.
/// Weak comparison is what RFC 9110 requires for GET/HEAD conditional requests.
pub fn if_none_match(headers: &HeaderMap, etag: &str) -> bool {
    headers
        .get(IF_NONE_MATCH)
        .is_some_and(|value| header_matches(value, etag))
}

pub fn header_matches(value: &HeaderValue, etag: &str) -> bool {
    let Ok(value) = value.to_str() else {
        return false;
    };
    for candidate in value.split(',') {
        let candidate = candidate.trim();
        if candidate == "*" {
            return true;
        }
        let candidate = candidate.strip_prefix("W/").unwrap_or(candidate);
        if candidate == etag {
            return true;
        }
    }
    false
}

pub async fn json_etag(request: Request, next: Next) -> Response {
    let head = request.method() == Method::HEAD;
    if request.method() != Method::GET && !head {
        return next.run(request).await;
    }

    // Run HEAD as GET so the body is available for the ETag; the body is
    // stripped again before the response leaves this middleware.
    let mut request = request;
    if head {
        *request.method_mut() = Method::GET;
    }

    // The layer wraps the nested API router, so the path is relative to
    // `API_PREFIX` here (`/admin/stats`, not `/api/admin/stats`).
    let path = request.uri().path().to_string();
    let private = path == "/admin"
        || path.starts_with("/admin/")
        || path == "/auth"
        || path.starts_with("/auth/");
    let request_etag = request.headers().get(IF_NONE_MATCH).cloned();
    let response = next.run(request).await;

    if !response.status().is_success() {
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
    let bytes = match to_bytes(body, MAX_JSON_BYTES).await {
        Ok(bytes) => bytes,
        Err(error) => {
            tracing::error!(error = %error, "Failed to buffer JSON response for ETag");
            return ApiError::internal("Không thể tạo phản hồi.").into_response();
        }
    };

    let etag = strong_etag(&bytes);
    let body_len = bytes.len();
    let cache_control = if private {
        "private, no-cache"
    } else {
        "no-cache"
    };

    let mut response = if request_etag
        .as_ref()
        .is_some_and(|value| header_matches(value, &etag))
    {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::NOT_MODIFIED;
        response
    } else {
        let body = if head {
            Body::empty()
        } else {
            Body::from(bytes)
        };
        Response::from_parts(parts, body)
    };

    let status = response.status();
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&etag) {
        headers.insert(ETAG, value);
    }
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache_control));
    if head && status != StatusCode::NOT_MODIFIED {
        if let Ok(value) = HeaderValue::from_str(&body_len.to_string()) {
            headers.insert(CONTENT_LENGTH, value);
        }
    }
    if private {
        headers.insert(VARY, HeaderValue::from_static("Authorization"));
    }
    response
}
