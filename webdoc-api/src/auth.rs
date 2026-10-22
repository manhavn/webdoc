use std::time::{SystemTime, UNIX_EPOCH};

use argon2::password_hash::rand_core::OsRng;
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use axum::extract::FromRequestParts;
use axum::http::header::AUTHORIZATION;
use axum::http::request::Parts;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::error::ApiError;
use crate::models::UserDoc;
use crate::AppState;

const TOKEN_TTL_SECONDS: u64 = 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

/// Authenticated administrator, extracted from `Authorization: Bearer <token>`.
pub struct CurrentAdmin(pub Claims);

impl FromRequestParts<AppState> for CurrentAdmin {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let header = parts
            .headers
            .get(AUTHORIZATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(ApiError::unauthorized)?;

        let mut pieces = header.split_whitespace();
        let scheme = pieces.next().unwrap_or_default();
        let token = pieces.next().ok_or_else(ApiError::unauthorized)?;
        if !scheme.eq_ignore_ascii_case("bearer") || pieces.next().is_some() {
            return Err(ApiError::unauthorized());
        }

        let mut validation = Validation::new(Algorithm::HS256);
        validation.leeway = 30;
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.config.jwt_secret.as_bytes()),
            &validation,
        )
        .map_err(|err| {
            tracing::debug!(error = %err, "Rejected JWT");
            ApiError::unauthorized()
        })?;

        Ok(CurrentAdmin(data.claims))
    }
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| {
            tracing::error!(error = %err, "Failed to hash password");
            ApiError::internal("Không thể xử lý mật khẩu.")
        })
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    match PasswordHash::new(hash) {
        Ok(parsed) => Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok(),
        Err(err) => {
            tracing::error!(error = %err, "Stored password hash is invalid");
            false
        }
    }
}

pub fn issue_token(config: &crate::config::Config, user: &UserDoc) -> Result<String, ApiError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let claims = Claims {
        sub: user.id.to_hex(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp: (now + TOKEN_TTL_SECONDS) as usize,
    };
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to sign JWT");
        ApiError::internal("Không thể tạo phiên đăng nhập.")
    })
}
