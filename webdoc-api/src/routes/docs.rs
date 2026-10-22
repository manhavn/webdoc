use axum::extract::{Path, State};
use axum::Json;
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, Bson, DateTime};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::auth::CurrentAdmin;
use crate::docs;
use crate::error::{ApiError, ApiJson, ApiQuery};
use crate::models::{DocCreateInput, DocDto, DocNode, DocPageDto, DocSummaryDto, DocUpdateInput};
use crate::routes::parse_object_id;
use crate::uploads;
use crate::AppState;

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DocPageQuery {
    #[serde(default)]
    pub path: Option<String>,
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

/// `GET /api/docs/tree` — published documentation tree without content.
pub async fn tree(State(state): State<AppState>) -> Result<Json<Vec<DocSummaryDto>>, ApiError> {
    let nodes = docs::load_published(&state.db).await?;
    Ok(Json(docs::build_tree(nodes)))
}

/// `GET /api/docs/page?path=/...` — one published page with its children and
/// breadcrumb trail.
pub async fn page(
    State(state): State<AppState>,
    ApiQuery(query): ApiQuery<DocPageQuery>,
) -> Result<Json<DocPageDto>, ApiError> {
    let path = query
        .path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ApiError::bad_request("Vui lòng truyền tham số path."))?;

    let node = docs::find_by_path(&state.db, path, true)
        .await?
        .ok_or_else(|| ApiError::not_found("Không tìm thấy trang tài liệu."))?;

    Ok(Json(build_page(&state, node).await?))
}

/// `GET /api/docs/by-id/:id` — same payload as `/api/docs/page`.
pub async fn by_id(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<DocPageDto>, ApiError> {
    let id = parse_object_id(&id)?;
    let node = docs::find_by_id(&state.db, id)
        .await?
        .filter(|node| node.published)
        .ok_or_else(|| ApiError::not_found("Không tìm thấy trang tài liệu."))?;

    Ok(Json(build_page(&state, node).await?))
}

async fn build_page(state: &AppState, node: DocNode) -> Result<DocPageDto, ApiError> {
    let published = docs::load_published(&state.db).await?;
    let by_id = published
        .iter()
        .cloned()
        .map(|doc| (doc.id, doc))
        .collect::<std::collections::HashMap<_, _>>();
    let breadcrumbs = docs::breadcrumbs(&node, &by_id);
    let children = docs::child_summaries(published, node.id);

    Ok(DocPageDto {
        id: node.id.to_hex(),
        title: node.title,
        slug: node.slug,
        path: node.path,
        parent_id: node.parent_id.map(|id| id.to_hex()),
        group: node.group,
        order: node.order,
        description: node.description,
        content: node.content,
        published: node.published,
        children,
        breadcrumbs,
    })
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

/// `GET /api/admin/docs` — every node (published or not) with full content.
pub async fn admin_list(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
) -> Result<Json<Vec<DocDto>>, ApiError> {
    let nodes = state
        .db
        .collection::<DocNode>(docs::COLLECTION)
        .find(doc! {})
        .sort(doc! { "path": 1, "order": 1 })
        .await?
        .try_collect::<Vec<_>>()
        .await?;

    Ok(Json(nodes.into_iter().map(DocNode::into_dto).collect()))
}

/// `GET /api/admin/docs/:id` — one node with full content.
pub async fn admin_get(
    State(state): State<AppState>,
    Path(id): Path<String>,
    _admin: CurrentAdmin,
) -> Result<Json<DocDto>, ApiError> {
    let id = parse_object_id(&id)?;
    let node = docs::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::not_found("Không tìm thấy tài liệu."))?;
    Ok(Json(node.into_dto()))
}

/// `POST /api/admin/docs` — create a node. The path defaults to the parent
/// path plus the slug; the slug defaults to the slugified title.
pub async fn admin_create(
    State(state): State<AppState>,
    _admin: CurrentAdmin,
    ApiJson(input): ApiJson<DocCreateInput>,
) -> Result<Json<DocDto>, ApiError> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err(ApiError::bad_request(
            "Tiêu đề tài liệu không được để trống.",
        ));
    }

    let parent = docs::resolve_parent(&state.db, input.parent_id.as_deref()).await?;

    let mut slug = input
        .slug
        .as_deref()
        .map(docs::normalize_slug)
        .unwrap_or_default();
    if slug.is_empty() {
        slug = docs::normalize_slug(title);
    }
    if slug.is_empty() {
        slug = "tai-lieu".to_string();
    }

    let path = match input
        .path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(raw) => docs::normalize_path(raw),
        None => docs::compose_path(parent.as_ref().map(|node| node.path.as_str()), &slug),
    };
    if path == "/" {
        return Err(ApiError::bad_request(
            "Đường dẫn tài liệu phải có ít nhất một cấp.",
        ));
    }
    docs::ensure_path_free(&state.db, &path, None).await?;
    docs::ensure_subtree_free(&state.db, &path, &[]).await?;

    let order = match input.order {
        Some(order) => order,
        None => docs::next_sibling_order(&state.db, parent.as_ref().map(|node| node.id)).await?,
    };

    let now = DateTime::now();
    let node = DocNode {
        id: ObjectId::new(),
        title: title.to_string(),
        slug,
        path,
        parent_id: parent.map(|node| node.id),
        group: input.group.unwrap_or(false),
        order,
        description: input
            .description
            .map(|value| value.trim().to_string())
            .unwrap_or_default(),
        content: input.content.unwrap_or_default(),
        published: input.published.unwrap_or(true),
        created_at: now,
        updated_at: now,
    };

    state
        .db
        .collection::<DocNode>(docs::COLLECTION)
        .insert_one(&node)
        .await?;

    Ok(Json(node.into_dto()))
}

/// `PUT /api/admin/docs/:id` — partial update. Moving a node (title, slug,
/// path or parent change) rewrites the paths of the whole subtree.
pub async fn admin_update(
    State(state): State<AppState>,
    Path(id): Path<String>,
    _admin: CurrentAdmin,
    ApiJson(input): ApiJson<DocUpdateInput>,
) -> Result<Json<DocDto>, ApiError> {
    let object_id = parse_object_id(&id)?;
    let mut node = docs::find_by_id(&state.db, object_id)
        .await?
        .ok_or_else(|| ApiError::not_found("Không tìm thấy tài liệu."))?;
    let old_path = node.path.clone();
    let old_images = uploads::extract_upload_files(&node.content);

    let mut title_changed = false;
    let mut slug_changed = false;
    let mut parent_changed = false;

    if let Some(title) = input.title.as_deref() {
        let title = title.trim();
        if title.is_empty() {
            return Err(ApiError::bad_request(
                "Tiêu đề tài liệu không được để trống.",
            ));
        }
        if node.title != title {
            node.title = title.to_string();
            title_changed = true;
        }
    }

    if let Some(slug) = input.slug.as_deref() {
        let mut candidate = docs::normalize_slug(slug);
        if candidate.is_empty() {
            candidate = docs::normalize_slug(&node.title);
        }
        if !candidate.is_empty() && candidate != node.slug {
            node.slug = candidate;
            slug_changed = true;
        }
    }

    if let Some(parent_value) = input.parent_id.as_ref() {
        let requested_parent = parent_value
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        match requested_parent {
            None => {
                if node.parent_id.is_some() {
                    node.parent_id = None;
                    parent_changed = true;
                }
            }
            Some(raw) => {
                let parent_id = ObjectId::parse_str(raw)
                    .map_err(|_| ApiError::bad_request("ID không hợp lệ."))?;
                if parent_id == node.id {
                    return Err(ApiError::bad_request(
                        "Tài liệu không thể là tài liệu cha của chính nó.",
                    ));
                }
                if docs::would_cycle(&state.db, node.id, parent_id).await? {
                    return Err(ApiError::bad_request(
                        "Không thể chuyển tài liệu vào chính nó hoặc tài liệu con của nó.",
                    ));
                }
                if node.parent_id != Some(parent_id) {
                    node.parent_id = Some(parent_id);
                    parent_changed = true;
                }
            }
        }
    }

    if let Some(group) = input.group {
        node.group = group;
    }
    if let Some(order) = input.order {
        node.order = order;
    }
    if let Some(description) = input.description {
        node.description = description.trim().to_string();
    }
    if let Some(content) = input.content {
        node.content = content;
    }
    if let Some(published) = input.published {
        node.published = published;
    }

    let parent = match node.parent_id {
        Some(parent_id) => Some(
            docs::find_by_id(&state.db, parent_id)
                .await?
                .ok_or_else(|| ApiError::bad_request("Tài liệu cha không tồn tại."))?,
        ),
        None => None,
    };

    let explicit_path = input
        .path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(docs::normalize_path);
    if explicit_path.as_deref() == Some("/") {
        return Err(ApiError::bad_request(
            "Đường dẫn tài liệu phải có ít nhất một cấp.",
        ));
    }

    let new_path = if let Some(path) = explicit_path {
        path
    } else if title_changed || slug_changed || parent_changed {
        if title_changed && !slug_changed {
            let derived = docs::normalize_slug(&node.title);
            if !derived.is_empty() {
                node.slug = derived;
            }
        }
        let candidate =
            docs::compose_path(parent.as_ref().map(|node| node.path.as_str()), &node.slug);
        if candidate == "/" {
            return Err(ApiError::bad_request(
                "Đường dẫn tài liệu phải có ít nhất một cấp.",
            ));
        }
        candidate
    } else {
        old_path.clone()
    };

    let collection = state.db.collection::<DocNode>(docs::COLLECTION);
    node.updated_at = DateTime::now();

    if new_path != old_path {
        let subtree = docs::descendants(&state.db, &old_path).await?;
        if subtree.iter().any(|descendant| descendant.path == new_path) {
            return Err(ApiError::bad_request(format!(
                "Đường dẫn \"{new_path}\" đang được sử dụng bởi một tài liệu con."
            )));
        }

        let mut exclude = vec![node.id];
        exclude.extend(subtree.iter().map(|descendant| descendant.id));
        docs::ensure_path_free(&state.db, &new_path, Some(node.id)).await?;
        docs::ensure_subtree_free(&state.db, &new_path, &exclude).await?;

        let now = node.updated_at;
        node.path = new_path.clone();
        collection
            .replace_one(doc! { "_id": node.id }, &node)
            .await?;

        for mut descendant in subtree {
            let Some(updated) = docs::replace_prefix(&descendant.path, &old_path, &new_path) else {
                continue;
            };
            descendant.path = updated;
            descendant.updated_at = now;
            collection
                .replace_one(doc! { "_id": descendant.id }, &descendant)
                .await?;
        }
    } else {
        collection
            .replace_one(doc! { "_id": node.id }, &node)
            .await?;
    }

    let new_images = uploads::extract_upload_files(&node.content);
    let removed: std::collections::HashSet<String> =
        old_images.difference(&new_images).cloned().collect();
    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed).await;

    Ok(Json(node.into_dto()))
}

/// `DELETE /api/admin/docs/:id` — remove the node and its whole subtree.
pub async fn admin_delete(
    State(state): State<AppState>,
    Path(id): Path<String>,
    _admin: CurrentAdmin,
) -> Result<Json<Value>, ApiError> {
    let id = parse_object_id(&id)?;
    let node = docs::find_by_id(&state.db, id)
        .await?
        .ok_or_else(|| ApiError::not_found("Không tìm thấy tài liệu."))?;

    let mut ids = vec![node.id];
    let mut removed_images = uploads::extract_upload_files(&node.content);
    let descendants = docs::descendants(&state.db, &node.path).await?;
    for descendant in &descendants {
        removed_images.extend(uploads::extract_upload_files(&descendant.content));
    }
    ids.extend(descendants.into_iter().map(|descendant| descendant.id));

    state
        .db
        .collection::<DocNode>(docs::COLLECTION)
        .delete_many(doc! {
            "_id": { "$in": Bson::Array(ids.into_iter().map(Bson::ObjectId).collect::<Vec<_>>()) },
        })
        .await?;

    uploads::delete_unreferenced_uploads(&state.db, &state.config.upload_dir, &removed_images)
        .await;

    Ok(Json(json!({ "ok": true })))
}
