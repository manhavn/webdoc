use axum::extract::State;
use axum::http::StatusCode;
use axum::Json;
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};

use crate::auth::{issue_token, verify_password, CurrentAdmin};
use crate::error::{ApiError, ApiJson};
use crate::models::{UserDoc, UserDto};
use crate::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub token: String,
    pub user: UserDto,
}

pub async fn login(
    State(state): State<AppState>,
    ApiJson(input): ApiJson<LoginInput>,
) -> Result<Json<LoginResponse>, ApiError> {
    let username = input.username.trim();
    if username.is_empty() || input.password.is_empty() {
        return Err(ApiError::bad_request(
            "Vui lòng nhập tên đăng nhập và mật khẩu.",
        ));
    }

    let users = state.db.collection::<UserDoc>("users");
    let user = users
        .find_one(doc! { "username": username })
        .await?
        .ok_or_else(|| {
            ApiError::new(StatusCode::UNAUTHORIZED, "Sai tên đăng nhập hoặc mật khẩu.")
        })?;

    if !verify_password(&input.password, &user.password_hash) {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "Sai tên đăng nhập hoặc mật khẩu.",
        ));
    }

    let token = issue_token(&state.config, &user)?;
    Ok(Json(LoginResponse {
        token,
        user: user.into_dto(),
    }))
}

pub async fn me(
    State(state): State<AppState>,
    admin: CurrentAdmin,
) -> Result<Json<UserDto>, ApiError> {
    let id = ObjectId::parse_str(&admin.0.sub).map_err(|_| ApiError::unauthorized())?;
    let users = state.db.collection::<UserDoc>("users");
    let user = users
        .find_one(doc! { "_id": id })
        .await?
        .ok_or_else(ApiError::unauthorized)?;
    Ok(Json(user.into_dto()))
}
