export const ROOT_KEY = '__root__';

export function toId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object' && value.$oid) return String(value.$oid);
  return String(value);
}

export function normalizeNode(raw) {
  return {
    ...raw,
    id: toId(raw.id ?? raw._id) || '',
    parentId: toId(raw.parentId ?? raw.parent_id),
    order: Number(raw.order) || 0,
    group: Boolean(raw.group),
    published: raw.published === undefined ? true : Boolean(raw.published),
  };
}

function compareNodes(a, b) {
  const orderA = Number(a.order) || 0;
  const orderB = Number(b.order) || 0;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.title || '').localeCompare(String(b.title || ''), 'vi');
}

export function buildTree(nodes) {
  const ids = new Set(nodes.map((node) => node.id));
  const children = new Map();
  nodes.forEach((node) => {
    const key = node.parentId && ids.has(node.parentId) ? node.parentId : ROOT_KEY;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(node);
  });
  children.forEach((list) => list.sort(compareNodes));
  return children;
}

export function flattenTree(tree, key = ROOT_KEY, depth = 0, out = []) {
  (tree.get(key) || []).forEach((node) => {
    out.push({ node, depth });
    flattenTree(tree, node.id, depth + 1, out);
  });
  return out;
}
