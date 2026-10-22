mod auth;
mod bson_json;
mod cache;
mod cli;
mod config;
mod db;
mod docs;
mod error;
mod http_cache;
mod migrate;
mod models;
mod routes;
mod seed;
mod slug;
mod static_assets;
mod uploads;

use std::sync::Arc;
use std::time::Duration;

use axum::extract::{DefaultBodyLimit, Path, Request, State};
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::{any, get, post};
use axum::Router;
use clap::Parser;
use mongodb::Database;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::error::ApiError;
use crate::static_assets::SiteAssets;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Arc<Config>,
    pub cache: Arc<cache::ApiCache>,
    pub ui_assets: Option<Arc<SiteAssets>>,
    pub admin_assets: Option<Arc<SiteAssets>>,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let options = cli::Cli::parse();
    let mut config = Config::from_env();
    if let Err(error) = cli::apply_overrides(&options, &mut config) {
        eprintln!("webdoc: {error}");
        std::process::exit(1);
    }

    match cli::handle(&options, &config) {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("webdoc: {error}");
            std::process::exit(1);
        }
    }

    if options.daemon && std::env::var_os("WEBDOC_DAEMONIZED").is_none() {
        match cli::daemonize(&options, &config) {
            Ok(()) => return,
            Err(error) => {
                eprintln!("webdoc: {error}");
                std::process::exit(1);
            }
        }
    }

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,tower_http=info")),
        )
        .init();

    if let Err(error) = run(config).await {
        tracing::error!(error = %error, "WebDoc API stopped with an error");
        std::process::exit(1);
    }
}

async fn run(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let config = Arc::new(config);

    tokio::fs::create_dir_all(&config.upload_dir).await?;

    let db = db::connect(&config).await?;
    db::ensure_indexes(&db).await?;
    seed::seed_core(&db, &config).await?;
    routes::appearance::ensure_homepage_persisted(&db).await?;
    if config.seed {
        seed::seed_demo(&db).await?;
    }
    migrate::i18n_ui(&db).await?;
    uploads::cleanup_all_orphan_uploads(&db, &config.upload_dir).await;

    let ui_assets = SiteAssets::resolve_ui(&config).map(Arc::new);
    let admin_assets = SiteAssets::resolve_admin(&config).map(Arc::new);
    let cache = cache::ApiCache::new(config.cache_dir.clone(), config.cache_ttl_secs);

    let state = AppState {
        db,
        config: config.clone(),
        cache,
        ui_assets,
        admin_assets,
    };

    let app = build_app(state, &config)
        .layer(DefaultBodyLimit::max(6 * 1024 * 1024))
        .layer(TraceLayer::new_for_http())
        .layer(cors_layer(&config));

    let listener = tokio::net::TcpListener::bind((config.host.as_str(), config.port)).await?;
    tracing::info!(
        host = %config.host,
        port = config.port,
        database = %config.mongodb_db,
        uploads = %config.upload_dir.display(),
        api_prefix = %config.api_prefix,
        admin_prefix = %config.admin_prefix,
        "WebDoc API listening"
    );

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    if std::env::var_os("WEBDOC_DAEMONIZED").is_some() {
        let pid_path = cli::pid_path(&config);
        if let Ok(text) = std::fs::read_to_string(&pid_path) {
            if text.trim() == std::process::id().to_string() {
                let _ = std::fs::remove_file(pid_path);
            }
        }
    }
    Ok(())
}

fn build_app(state: AppState, config: &Config) -> Router {
    let auth_routes = Router::new()
        .route("/login", post(routes::auth::login))
        .route("/me", get(routes::auth::me));

    let cache = state.cache.clone();
    let public_routes = Router::new()
        .route("/health", get(routes::public::health))
        .route("/journals", get(routes::public::journals))
        .route("/partners", get(routes::public::journals))
        .route("/settings/layout", get(routes::public::layout))
        .route("/settings/site", get(routes::public::site))
        .route("/settings/appearance", get(routes::appearance::public_get))
        .route("/i18n", get(routes::i18n::config))
        .route("/i18n/{code}", get(routes::i18n::messages))
        .route("/docs/tree", get(routes::docs::tree))
        .route("/docs/page", get(routes::docs::page))
        .route("/docs/by-id/{id}", get(routes::docs::by_id))
        .route("/contact", post(routes::public::contact))
        .layer(middleware::from_fn_with_state(cache, cache::public_cache));

    let admin_routes = Router::new()
        .route("/stats", get(routes::admin::stats))
        .route(
            "/layout",
            get(routes::admin::get_layout).put(routes::admin::put_layout),
        )
        .route(
            "/site",
            get(routes::admin::get_site).put(routes::admin::put_site),
        )
        .route(
            "/appearance",
            get(routes::appearance::admin_get).put(routes::appearance::admin_put),
        )
        .route(
            "/appearance/homepage/reset",
            post(routes::appearance::admin_reset_homepage),
        )
        .route(
            "/docs",
            get(routes::docs::admin_list).post(routes::docs::admin_create),
        )
        .route(
            "/docs/{id}",
            get(routes::docs::admin_get)
                .put(routes::docs::admin_update)
                .delete(routes::docs::admin_delete),
        )
        .route(
            "/i18n",
            get(routes::i18n::admin_list).post(routes::i18n::admin_create),
        )
        .route("/i18n/reset", post(routes::i18n::admin_reset))
        .route(
            "/i18n/{code}",
            get(routes::i18n::admin_get)
                .put(routes::i18n::admin_update)
                .delete(routes::i18n::admin_delete),
        )
        .route("/upload", post(uploads::upload))
        .route("/export", get(routes::backup::export))
        .route(
            "/import",
            post(routes::backup::import)
                .layer(DefaultBodyLimit::max(routes::backup::MAX_IMPORT_BODY_BYTES)),
        )
        .route("/change-password", post(routes::admin::change_password));

    let cache = state.cache.clone();
    let admin_routes = admin_routes.layer(middleware::from_fn_with_state(
        cache,
        cache::invalidate_on_write,
    ));

    let api = Router::new()
        .nest("/auth", auth_routes)
        .merge(public_routes)
        .nest("/admin", admin_routes)
        .fallback(api_not_found)
        .layer(middleware::from_fn(http_cache::json_etag));

    let mut app = Router::new()
        .nest(&config.api_prefix, api)
        .route("/uploads", any(not_found))
        .route("/uploads/{*path}", get(uploads::serve));

    // Never let the public SPA fallback swallow reserved API/CMS prefixes.
    if config.api_prefix != "/api" {
        app = app
            .route("/api", any(api_not_found))
            .route("/api/", any(api_not_found))
            .route("/api/{*rest}", any(api_not_found));
    }
    if config.admin_prefix != "/admin" {
        app = app
            .route("/admin", any(api_not_found))
            .route("/admin/", any(api_not_found))
            .route("/admin/{*rest}", any(api_not_found));
    }

    // `/admin` and `/admin/*` are always reserved: embedded assets in release
    // builds, or an explicit ADMIN_DIST during development.
    app = app
        .route(&config.admin_prefix, get(admin_index))
        .route(&format!("{}/", config.admin_prefix), get(admin_index))
        .route(
            &format!("{}/{{*path}}", config.admin_prefix),
            get(admin_file),
        );

    if state.ui_assets.is_some() {
        app = app.fallback(ui_file);
    } else {
        app = app.fallback(not_found);
    }

    app.with_state(state)
}

async fn admin_index(State(state): State<AppState>, headers: HeaderMap) -> Response {
    serve_admin(&state, "", &headers).await
}

async fn admin_file(
    State(state): State<AppState>,
    Path(path): Path<String>,
    headers: HeaderMap,
) -> Response {
    serve_admin(&state, &path, &headers).await
}

async fn serve_admin(state: &AppState, path: &str, headers: &HeaderMap) -> Response {
    match &state.admin_assets {
        Some(assets) => static_assets::serve(assets, path, headers).await,
        None => ApiError::new(StatusCode::NOT_FOUND, "Admin UI is not available").into_response(),
    }
}

async fn ui_file(State(state): State<AppState>, request: Request) -> Response {
    match &state.ui_assets {
        Some(assets) => static_assets::serve(assets, request.uri().path(), request.headers()).await,
        None => not_found().await.into_response(),
    }
}

async fn not_found() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "Not found")
}

async fn api_not_found() -> ApiError {
    ApiError::new(StatusCode::NOT_FOUND, "API endpoint not found")
}

fn cors_layer(config: &Config) -> CorsLayer {
    let base = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
        .max_age(Duration::from_secs(3600));

    if config.cors_origins.iter().any(|origin| origin == "*") {
        return base.allow_origin(AllowOrigin::any());
    }

    let origins = config
        .cors_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect::<Vec<_>>();
    if origins.is_empty() {
        base
    } else {
        base.allow_origin(AllowOrigin::list(origins))
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutting down");
}
