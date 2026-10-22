use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{FromRequest, FromRequestParts, Query, Request};
use axum::http::request::Parts;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::de::DeserializeOwned;
use serde_json::json;

/// Uniform API error. Every failure is rendered as `{"error": "..."}` so the
/// static site and the admin CMS can display a useful message.
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, message)
    }

    pub fn unauthorized() -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "Unauthorized")
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json(json!({ "error": self.message }))).into_response()
    }
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.status, self.message)
    }
}

impl std::error::Error for ApiError {}

/// Database failures are logged with their full detail but reported to
/// clients as a generic 500 so internal information never leaks.
impl From<mongodb::error::Error> for ApiError {
    fn from(err: mongodb::error::Error) -> Self {
        tracing::error!(error = %err, "MongoDB operation failed");
        if is_duplicate_key(&err) {
            return Self::bad_request("Dữ liệu đã tồn tại (trùng khoá duy nhất).");
        }
        Self::internal("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.")
    }
}

impl From<mongodb::bson::ser::Error> for ApiError {
    fn from(err: mongodb::bson::ser::Error) -> Self {
        tracing::error!(error = %err, "BSON serialization failed");
        Self::internal("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.")
    }
}

impl From<mongodb::bson::de::Error> for ApiError {
    fn from(err: mongodb::bson::de::Error) -> Self {
        tracing::error!(error = %err, "BSON deserialization failed");
        Self::internal("Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.")
    }
}

pub fn is_duplicate_key(err: &mongodb::error::Error) -> bool {
    err.to_string().contains("E11000") || err.to_string().contains("duplicate key")
}

/// JSON body extractor whose rejections are JSON too.
pub struct ApiJson<T>(pub T);

impl<S, T> FromRequest<S> for ApiJson<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(req, state).await {
            Ok(Json(value)) => Ok(ApiJson(value)),
            Err(rejection) => Err(json_rejection(rejection)),
        }
    }
}

fn json_rejection(rejection: JsonRejection) -> ApiError {
    ApiError::bad_request(match rejection {
        JsonRejection::JsonDataError(_) => "Dữ liệu gửi lên không đúng định dạng.".to_string(),
        JsonRejection::JsonSyntaxError(_) => "JSON không hợp lệ.".to_string(),
        JsonRejection::MissingJsonContentType(_) => {
            "Yêu cầu phải có Content-Type: application/json.".to_string()
        }
        _ => "Không thể đọc dữ liệu gửi lên.".to_string(),
    })
}

/// Query-string extractor with JSON error responses.
pub struct ApiQuery<T>(pub T);

impl<S, T> FromRequestParts<S> for ApiQuery<T>
where
    S: Send + Sync,
    T: DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match Query::<T>::from_request_parts(parts, state).await {
            Ok(Query(value)) => Ok(ApiQuery(value)),
            Err(QueryRejection::FailedToDeserializeQueryString(_)) => {
                Err(ApiError::bad_request("Tham số truy vấn không hợp lệ."))
            }
            Err(_) => Err(ApiError::bad_request("Tham số truy vấn không hợp lệ.")),
        }
    }
}
