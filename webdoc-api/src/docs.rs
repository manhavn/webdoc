use std::collections::{HashMap, HashSet};

use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId, Bson, Document};
use mongodb::Database;

use crate::error::ApiError;
use crate::models::{DocBreadcrumbDto, DocNode, DocSummaryDto};
use crate::slug::slugify;

/// MongoDB collection that stores the documentation tree.
pub const COLLECTION: &str = "docs";

/// Normalise a public document path: a single leading slash, no trailing
/// slash and no empty segments. The root path collapses to `/`.
///
/// ```text
/// normalize_path(" /huong-dan/ ") == "/huong-dan"
/// normalize_path("//a//b/")       == "/a/b"
/// normalize_path("")              == "/"
/// ```
pub fn normalize_path(raw: &str) -> String {
    let segments = raw
        .split('/')
        .map(str::trim)
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>();
    if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    }
}

/// Normalise a single URL segment. Slashes and diacritics are converted with
/// the shared `slugify` rules.
pub fn normalize_slug(raw: &str) -> String {
    slugify(raw.trim().trim_matches('/'))
}

/// Path used by a child of `parent_path`. `None` or `/` produces a root path.
pub fn compose_path(parent_path: Option<&str>, slug: &str) -> String {
    match parent_path.map(normalize_path).as_deref() {
        None | Some("/") => format!("/{slug}"),
        Some(parent) => format!("{parent}/{slug}"),
    }
}

/// Prefix shared by every descendant of `path`.
pub fn path_prefix(path: &str) -> String {
    let path = normalize_path(path);
    if path == "/" {
        "/".to_string()
    } else {
        format!("{path}/")
    }
}

/// Replace the `old` prefix of `path` with `new`, keeping the remainder.
pub fn replace_prefix(path: &str, old: &str, new: &str) -> Option<String> {
    let old = normalize_path(old);
    let new = normalize_path(new);
    if path == old {
        return Some(new);
    }
    let prefix = path_prefix(&old);
    path.strip_prefix(&prefix)
        .map(|rest| format!("{}/{}", new.trim_end_matches('/'), rest))
}

/// Sort used for every docs listing: manual `order`, then title.
pub fn compare_nodes(a: &DocNode, b: &DocNode) -> std::cmp::Ordering {
    a.order
        .cmp(&b.order)
        .then_with(|| a.title.cmp(&b.title))
        .then_with(|| a.path.cmp(&b.path))
}

/// Build the nested tree from a flat list. Nodes whose parent is not part of
/// the list (for example an unpublished parent) are promoted to roots so they
/// never disappear from the navigation.
pub fn build_tree(mut nodes: Vec<DocNode>) -> Vec<DocSummaryDto> {
    nodes.sort_by(compare_nodes);
    let ids = nodes.iter().map(|node| node.id).collect::<HashSet<_>>();
    let mut by_parent: HashMap<ObjectId, Vec<DocNode>> = HashMap::new();
    let mut roots = Vec::new();
    for node in nodes {
        match node.parent_id {
            Some(parent) if ids.contains(&parent) => {
                by_parent.entry(parent).or_default().push(node);
            }
            _ => roots.push(node),
        }
    }
    roots
        .into_iter()
        .map(|node| build_summary(node, &mut by_parent))
        .collect()
}

fn build_summary(node: DocNode, by_parent: &mut HashMap<ObjectId, Vec<DocNode>>) -> DocSummaryDto {
    let mut kids = by_parent.remove(&node.id).unwrap_or_default();
    kids.sort_by(compare_nodes);
    let children = kids
        .into_iter()
        .map(|kid| build_summary(kid, by_parent))
        .collect();
    node.to_summary(children)
}

/// Direct children (with their own nested descendants) of `parent_id`.
pub fn child_summaries(nodes: Vec<DocNode>, parent_id: ObjectId) -> Vec<DocSummaryDto> {
    fn find(nodes: &[DocSummaryDto], id: &str) -> Option<DocSummaryDto> {
        for node in nodes {
            if node.id == id {
                return Some(node.clone());
            }
            if let Some(hit) = find(&node.children, id) {
                return Some(hit);
            }
        }
        None
    }

    find(&build_tree(nodes), &parent_id.to_hex())
        .map(|node| node.children)
        .unwrap_or_default()
}

/// Ancestor trail of `node`, ordered from the root to the direct parent. The
/// node itself is intentionally excluded; the UI appends its own title.
pub fn breadcrumbs(node: &DocNode, by_id: &HashMap<ObjectId, DocNode>) -> Vec<DocBreadcrumbDto> {
    let mut trail = Vec::new();
    let mut cursor = node.parent_id;
    let mut guard = 0usize;
    while let Some(id) = cursor {
        guard += 1;
        if guard > 512 {
            break;
        }
        let Some(parent) = by_id.get(&id) else {
            break;
        };
        trail.push(DocBreadcrumbDto {
            title: parent.title.clone(),
            path: parent.path.clone(),
        });
        cursor = parent.parent_id;
    }
    trail.reverse();
    trail
}

pub async fn load_published(db: &Database) -> Result<Vec<DocNode>, ApiError> {
    let docs = db
        .collection::<DocNode>(COLLECTION)
        .find(doc! { "published": true })
        .sort(doc! { "path": 1, "order": 1 })
        .await?
        .try_collect::<Vec<_>>()
        .await?;
    Ok(docs)
}

pub async fn find_by_id(db: &Database, id: ObjectId) -> Result<Option<DocNode>, ApiError> {
    Ok(db
        .collection::<DocNode>(COLLECTION)
        .find_one(doc! { "_id": id })
        .await?)
}

pub async fn find_by_path(
    db: &Database,
    path: &str,
    published_only: bool,
) -> Result<Option<DocNode>, ApiError> {
    let mut filter = doc! { "path": normalize_path(path) };
    if published_only {
        filter.insert("published", true);
    }
    Ok(db
        .collection::<DocNode>(COLLECTION)
        .find_one(filter)
        .await?)
}

/// Every node below `path`, independent of the stored parent links.
pub async fn descendants(db: &Database, path: &str) -> Result<Vec<DocNode>, ApiError> {
    let pattern = format!("^{}", regex::escape(&path_prefix(path)));
    let docs = db
        .collection::<DocNode>(COLLECTION)
        .find(doc! { "path": { "$regex": &pattern } })
        .await?
        .try_collect::<Vec<_>>()
        .await?;
    Ok(docs)
}

/// Fail with a clear 400 when `path` already belongs to another node.
pub async fn ensure_path_free(
    db: &Database,
    path: &str,
    exclude: Option<ObjectId>,
) -> Result<(), ApiError> {
    let mut filter = doc! { "path": normalize_path(path) };
    if let Some(id) = exclude {
        filter.insert("_id", doc! { "$ne": id });
    }
    if let Some(node) = db
        .collection::<DocNode>(COLLECTION)
        .find_one(filter)
        .await?
    {
        return Err(ApiError::bad_request(format!(
            "Đường dẫn \"{path}\" đã được sử dụng bởi tài liệu \"{}\".",
            node.title
        )));
    }
    Ok(())
}

/// Reject a path that would collide with a foreign subtree.
pub async fn ensure_subtree_free(
    db: &Database,
    path: &str,
    exclude: &[ObjectId],
) -> Result<(), ApiError> {
    let pattern = format!("^{}", regex::escape(&path_prefix(path)));
    let mut filter = doc! { "path": { "$regex": &pattern } };
    if !exclude.is_empty() {
        let ids = exclude
            .iter()
            .map(|id| Bson::ObjectId(*id))
            .collect::<Vec<_>>();
        filter.insert("_id", doc! { "$nin": Bson::Array(ids) });
    }
    if let Some(node) = db
        .collection::<DocNode>(COLLECTION)
        .find_one(filter)
        .await?
    {
        return Err(ApiError::bad_request(format!(
            "Đường dẫn \"{path}\" xung đột với tài liệu \"{}\".",
            node.title
        )));
    }
    Ok(())
}

/// Resolve a parent identifier from an admin payload, validating that it
/// exists. Returns `None` when no parent was provided.
pub async fn resolve_parent(db: &Database, raw: Option<&str>) -> Result<Option<DocNode>, ApiError> {
    let Some(value) = raw.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let id = ObjectId::parse_str(value).map_err(|_| ApiError::bad_request("ID không hợp lệ."))?;
    let parent = find_by_id(db, id)
        .await?
        .ok_or_else(|| ApiError::bad_request("Tài liệu cha không tồn tại."))?;
    Ok(Some(parent))
}

/// True when `parent_id` is the node itself or one of its descendants.
pub async fn would_cycle(
    db: &Database,
    node_id: ObjectId,
    parent_id: ObjectId,
) -> Result<bool, ApiError> {
    let mut cursor = Some(parent_id);
    let mut guard = 0usize;
    while let Some(id) = cursor {
        if id == node_id {
            return Ok(true);
        }
        guard += 1;
        if guard > 512 {
            break;
        }
        cursor = find_by_id(db, id).await?.and_then(|node| node.parent_id);
    }
    Ok(false)
}

/// Next free `order` among the siblings of `parent`.
pub async fn next_sibling_order(
    db: &Database,
    parent_id: Option<ObjectId>,
) -> Result<i32, ApiError> {
    let mut filter = Document::new();
    filter.insert(
        "parentId",
        match parent_id {
            Some(id) => Bson::ObjectId(id),
            None => Bson::Null,
        },
    );
    let last = db
        .collection::<DocNode>(COLLECTION)
        .find_one(filter)
        .sort(doc! { "order": -1 })
        .await?;
    Ok(last.map(|node| node.order + 1).unwrap_or(1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::DateTime;

    fn node(id: ObjectId, path: &str, parent_id: Option<ObjectId>, order: i32) -> DocNode {
        DocNode {
            id,
            title: format!("Node {path}"),
            slug: path.trim_start_matches('/').to_string(),
            path: path.to_string(),
            parent_id,
            group: true,
            order,
            description: String::new(),
            content: String::new(),
            published: true,
            created_at: DateTime::now(),
            updated_at: DateTime::now(),
        }
    }

    #[test]
    fn normalizes_paths() {
        assert_eq!(normalize_path(""), "/");
        assert_eq!(normalize_path("/"), "/");
        assert_eq!(normalize_path("//a//b/"), "/a/b");
        assert_eq!(normalize_path(" /huong-dan/ "), "/huong-dan");
        assert_eq!(normalize_path("a/b"), "/a/b");
    }

    #[test]
    fn composes_paths() {
        assert_eq!(compose_path(None, "huong-dan"), "/huong-dan");
        assert_eq!(compose_path(Some("/"), "huong-dan"), "/huong-dan");
        assert_eq!(
            compose_path(Some("/huong-dan"), "tai-khoan"),
            "/huong-dan/tai-khoan"
        );
    }

    #[test]
    fn replaces_prefixes() {
        assert_eq!(
            replace_prefix("/a/b/c", "/a/b", "/x/y"),
            Some("/x/y/c".to_string())
        );
        assert_eq!(replace_prefix("/a/b", "/a/b", "/x"), Some("/x".to_string()));
        assert_eq!(replace_prefix("/a/bc", "/a/b", "/x"), None);
    }

    #[test]
    fn builds_nested_sorted_tree() {
        let root = ObjectId::new();
        let second = ObjectId::new();
        let third = ObjectId::new();
        let nodes = vec![
            node(root, "/root", None, 2),
            node(second, "/root/b", Some(root), 2),
            node(third, "/root/a", Some(root), 1),
        ];
        let tree = build_tree(nodes);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].children.len(), 2);
        assert_eq!(tree[0].children[0].path, "/root/a");
        assert_eq!(tree[0].children[1].path, "/root/b");
    }

    #[test]
    fn promotes_orphans_to_roots() {
        let missing = ObjectId::new();
        let orphan = ObjectId::new();
        let tree = build_tree(vec![node(orphan, "/orphan", Some(missing), 1)]);
        assert_eq!(tree.len(), 1);
        assert_eq!(tree[0].path, "/orphan");
    }

    #[test]
    fn builds_breadcrumbs_without_self() {
        let root = ObjectId::new();
        let child = ObjectId::new();
        let leaf = ObjectId::new();
        let root_node = node(root, "/root", None, 1);
        let child_node = node(child, "/root/child", Some(root), 1);
        let leaf_node = node(leaf, "/root/child/leaf", Some(child), 1);
        let by_id = [
            (root, root_node.clone()),
            (child, child_node.clone()),
            (leaf, leaf_node.clone()),
        ]
        .into_iter()
        .collect::<HashMap<_, _>>();

        let trail = breadcrumbs(&leaf_node, &by_id);
        assert_eq!(trail.len(), 2);
        assert_eq!(trail[0].path, "/root");
        assert_eq!(trail[1].path, "/root/child");
    }
}
