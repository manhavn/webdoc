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

const DEFAULT_TOKEN_TTL_SECONDS: u64 = 24 * 60 * 60;

pub fn token_ttl_seconds(days: Option<u32>) -> u64 {
    match days {
        Some(d) if d > 0 => (d.clamp(1, 3650) as u64) * 24 * 60 * 60,
        _ => DEFAULT_TOKEN_TTL_SECONDS,
    }
}

pub fn generate_random_secret() -> String {
    format!(
        "{}{}",
        uuid::Uuid::new_v4().simple(),
        uuid::Uuid::new_v4().simple()
    )
}

pub fn combined_jwt_secret(app_jwt_secret: &str, user_secret_key: &str) -> String {
    format!("{}:{}", app_jwt_secret, user_secret_key)
}

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

        let mut insecure_validation = Validation::new(Algorithm::HS256);
        insecure_validation.insecure_disable_signature_validation();
        let unverified = decode::<Claims>(
            token,
            &DecodingKey::from_secret(b""),
            &insecure_validation,
        )
        .map_err(|_| ApiError::unauthorized())?;
        let user_id = mongodb::bson::oid::ObjectId::parse_str(&unverified.claims.sub)
            .map_err(|_| ApiError::unauthorized())?;

        let user = state
            .db
            .collection::<UserDoc>("users")
            .find_one(mongodb::bson::doc! { "_id": user_id })
            .await
            .map_err(|_| ApiError::unauthorized())?
            .ok_or_else(ApiError::unauthorized)?;

        let secret = combined_jwt_secret(&state.config.jwt_secret, &user.secret_key);

        let mut validation = Validation::new(Algorithm::HS256);
        validation.leeway = 30;
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
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

pub fn issue_token(
    config: &crate::config::Config,
    user: &UserDoc,
    token_days: Option<u32>,
) -> Result<String, ApiError> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let ttl = token_ttl_seconds(token_days);
    let claims = Claims {
        sub: user.id.to_hex(),
        username: user.username.clone(),
        role: user.role.clone(),
        exp: (now + ttl) as usize,
    };
    let secret = combined_jwt_secret(&config.jwt_secret, &user.secret_key);
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|err| {
        tracing::error!(error = %err, "Failed to sign JWT");
        ApiError::internal("Không thể tạo phiên đăng nhập.")
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::default_allowed_routes;
    use mongodb::bson::oid::ObjectId;

    #[test]
    fn calculates_token_ttl_seconds() {
        assert_eq!(token_ttl_seconds(None), 86_400);
        assert_eq!(token_ttl_seconds(Some(0)), 86_400);
        assert_eq!(token_ttl_seconds(Some(1)), 86_400);
        assert_eq!(token_ttl_seconds(Some(30)), 30 * 86_400);
        assert_eq!(token_ttl_seconds(Some(365)), 365 * 86_400);
        assert_eq!(token_ttl_seconds(Some(10_000)), 3650 * 86_400);
    }

    #[test]
    fn issue_token_sets_correct_expiration() {
        let mut config = crate::config::Config::from_env();
        config.jwt_secret = "secret-key-for-testing-purposes-123456".to_string();
        let user = UserDoc {
            id: ObjectId::new(),
            username: "admin".to_string(),
            password_hash: "hash".to_string(),
            role: "admin".to_string(),
            secret_key: "user-secret-123".to_string(),
            allowed_routes: default_allowed_routes(),
            created_at: mongodb::bson::DateTime::now(),
            updated_at: mongodb::bson::DateTime::now(),
        };

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 30 days token
        let token = issue_token(&config, &user, Some(30)).unwrap();
        let mut validation = Validation::new(Algorithm::HS256);
        validation.leeway = 30;
        let data = decode::<Claims>(
            &token,
            &DecodingKey::from_secret(combined_jwt_secret(&config.jwt_secret, &user.secret_key).as_bytes()),
            &validation,
        )
        .unwrap();

        let expected_exp = now + 30 * 86_400;
        assert!((data.claims.exp as i64 - expected_exp as i64).abs() <= 2);
    }

    #[test]
    fn invalidates_token_when_user_secret_changes() {
        let mut config = crate::config::Config::from_env();
        config.jwt_secret = "app-secret".to_string();
        let mut user = UserDoc {
            id: ObjectId::new(),
            username: "admin".to_string(),
            password_hash: "hash".to_string(),
            role: "admin".to_string(),
            secret_key: "old-user-secret".to_string(),
            allowed_routes: default_allowed_routes(),
            created_at: mongodb::bson::DateTime::now(),
            updated_at: mongodb::bson::DateTime::now(),
        };

        let token = issue_token(&config, &user, Some(1)).unwrap();
        let validation = Validation::new(Algorithm::HS256);

        // Verified with old secret: succeeds
        let old_combined = combined_jwt_secret(&config.jwt_secret, &user.secret_key);
        assert!(decode::<Claims>(&token, &DecodingKey::from_secret(old_combined.as_bytes()), &validation).is_ok());

        // User secret changes in database
        user.secret_key = "new-user-secret".to_string();
        let new_combined = combined_jwt_secret(&config.jwt_secret, &user.secret_key);
        // Token decode fails with new secret
        assert!(decode::<Claims>(&token, &DecodingKey::from_secret(new_combined.as_bytes()), &validation).is_err());
    }
}
