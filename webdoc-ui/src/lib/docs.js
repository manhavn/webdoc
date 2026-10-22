import fallbackFlat from '../data/docs.json'

export const fallbackDocsFlat = fallbackFlat

export function buildDocsTree(flat) {
  if (!Array.isArray(flat) || flat.length === 0) return []
  const byPath = new Map()
  flat.forEach((node) => {
    byPath.set(node.path, { ...node, children: [] })
  })
  const roots = []
  flat.forEach((node) => {
    const item = byPath.get(node.path)
    if (node.parentPath && byPath.has(node.parentPath)) {
      byPath.get(node.parentPath).children.push(item)
    } else {
      roots.push(item)
    }
  })
  const sort = (items) => {
    items.sort((a, b) => (a.order || 0) - (b.order || 0) || a.title.localeCompare(b.title))
    items.forEach((item) => sort(item.children))
  }
  sort(roots)
  return roots
}

export const fallbackDocsTree = buildDocsTree(
  fallbackFlat.map((node) => ({
    ...node,
    id: node.path,
    parentId: node.parentPath || null,
    parentPath: node.parentPath || null,
  })),
)

export function flattenDocs(nodes = fallbackDocsTree, parents = []) {
  const out = []
  nodes.forEach((node) => {
    if (node.published === false) return
    out.push({
      id: node.id,
      title: node.title,
      link: node.path,
      group: node.group,
      parents: parents.map((p) => p.title),
    })
    if (node.children && node.children.length) {
      out.push(...flattenDocs(node.children, [...parents, node]))
    }
  })
  return out
}

/* Resolve a group to the article a visitor should land on: descend through
   nested groups and return the first leaf. Nested groups resolve to their own
   first article; a group with no article at all returns null. */
export function firstArticlePath(node) {
  for (const child of node?.children || []) {
    if (child.published === false) continue
    if (child.group) {
      const nested = firstArticlePath(child)
      if (nested) return nested
    } else if (child.path) {
      return child.path
    }
  }
  return null
}

/* Canonical form used for route params and URLs: leading slash, no trailing
   slash (except the root). */
export function normalizeDocPath(value) {
  const path = '/' + String(value || '').replace(/^\/+|\/+$/g, '')
  return path === '/' ? '/' : path.replace(/\/+$/g, '')
}

export function findDoc(nodes, path) {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children && node.children.length) {
      const hit = findDoc(node.children, path)
      if (hit) return hit
    }
  }
  return null
}
