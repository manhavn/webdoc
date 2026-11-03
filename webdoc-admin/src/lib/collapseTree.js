export const DOCS_COLLAPSE_STORAGE_KEY = 'webdoc_docs_collapsed_tree';

export function loadStoredCollapseTree() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(DOCS_COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* storage or parse error */
  }
  return {};
}

export function saveStoredCollapseTree(tree) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(DOCS_COLLAPSE_STORAGE_KEY, JSON.stringify(tree || {}));
  } catch {
    /* storage quota error */
  }
}

export function getNodeKey(node) {
  if (!node) return '';
  return node.slug || node.id || '';
}

export function getAncestorKeys(nodeId, nodes) {
  if (!nodeId || !Array.isArray(nodes)) return [];
  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const ancestors = [];
  let current = nodesById.get(nodeId);
  while (current && current.parentId) {
    const parent = nodesById.get(current.parentId);
    if (!parent) break;
    ancestors.unshift(getNodeKey(parent));
    current = parent;
  }
  return ancestors;
}

function findGroupEntry(groupsArray, key) {
  if (!Array.isArray(groupsArray)) return null;
  return groupsArray.find((item) => item && typeof item === 'object' && key in item) || null;
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

export function pruneRecord(record) {
  if (!record || typeof record !== 'object') return null;

  const prunedGroups = [];
  if (Array.isArray(record.groups)) {
    for (const entry of record.groups) {
      if (!entry || typeof entry !== 'object') continue;
      const keys = Object.keys(entry);
      if (keys.length === 0) continue;
      const k = keys[0];
      const childRecord = pruneRecord(entry[k]);
      if (childRecord) {
        prunedGroups.push({ [k]: childRecord });
      }
    }
  }

  const hasCollapse = Boolean(record.collapse);
  const hasGroups = prunedGroups.length > 0;
  if (!hasCollapse && !hasGroups) {
    return null;
  }

  const out = {};
  if (hasCollapse) out.collapse = true;
  if (hasGroups) out.groups = prunedGroups;
  return out;
}

export function pruneTree(tree) {
  if (!tree || typeof tree !== 'object') return {};
  const result = {};
  for (const [key, record] of Object.entries(tree)) {
    const pruned = pruneRecord(record);
    if (pruned) {
      result[key] = pruned;
    }
  }
  return result;
}

export function setNodeCollapsed(tree, ancestorKeys = [], nodeKey, collapsed) {
  if (!nodeKey) return tree || {};
  const nextTree = clone(tree || {});

  if (!ancestorKeys || ancestorKeys.length === 0) {
    if (collapsed) {
      if (!nextTree[nodeKey]) nextTree[nodeKey] = {};
      nextTree[nodeKey].collapse = true;
    } else {
      if (nextTree[nodeKey]) {
        delete nextTree[nodeKey].collapse;
      }
    }
    return pruneTree(nextTree);
  }

  // Ensure root ancestor exists
  const rootKey = ancestorKeys[0];
  if (!nextTree[rootKey]) nextTree[rootKey] = {};
  let currentRecord = nextTree[rootKey];

  for (let i = 1; i < ancestorKeys.length; i++) {
    const parentKey = ancestorKeys[i];
    if (!currentRecord.groups) currentRecord.groups = [];
    let entry = findGroupEntry(currentRecord.groups, parentKey);
    if (!entry) {
      entry = { [parentKey]: {} };
      currentRecord.groups.push(entry);
    }
    currentRecord = entry[parentKey];
  }

  // currentRecord is now the immediate parent of nodeKey
  if (!currentRecord.groups) currentRecord.groups = [];
  let targetEntry = findGroupEntry(currentRecord.groups, nodeKey);
  if (!targetEntry) {
    targetEntry = { [nodeKey]: {} };
    currentRecord.groups.push(targetEntry);
  }

  if (collapsed) {
    targetEntry[nodeKey].collapse = true;
  } else {
    delete targetEntry[nodeKey].collapse;
  }

  return pruneTree(nextTree);
}

export function collectCollapsedIds(collapseTree, nodes) {
  const collapsedIds = new Set();
  if (!collapseTree || typeof collapseTree !== 'object' || !Array.isArray(nodes)) {
    return collapsedIds;
  }

  const byParent = new Map();
  const rootNodes = [];
  for (const n of nodes) {
    if (!n.parentId) {
      rootNodes.push(n);
    } else {
      if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
      byParent.get(n.parentId).push(n);
    }
  }

  function matchNode(list, key) {
    if (!list) return null;
    return list.find((n) => getNodeKey(n) === key || n.id === key);
  }

  function walk(recordMap, candidateNodes) {
    if (!recordMap) return;
    for (const [key, record] of Object.entries(recordMap)) {
      const node = matchNode(candidateNodes, key);
      if (!node) continue;
      if (record && record.collapse) {
        collapsedIds.add(node.id);
      }
      if (record && Array.isArray(record.groups)) {
        const childCandidates = byParent.get(node.id) || [];
        for (const entry of record.groups) {
          if (!entry || typeof entry !== 'object') continue;
          for (const [childKey, childRecord] of Object.entries(entry)) {
            walk({ [childKey]: childRecord }, childCandidates);
          }
        }
      }
    }
  }

  walk(collapseTree, rootNodes);
  return collapsedIds;
}

export function buildCollapseAllTree(nodes) {
  if (!Array.isArray(nodes)) return {};
  const byParent = new Map();
  const rootNodes = [];
  for (const n of nodes) {
    if (!n.parentId) {
      rootNodes.push(n);
    } else {
      if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
      byParent.get(n.parentId).push(n);
    }
  }

  function buildRecord(node) {
    const children = byParent.get(node.id) || [];
    const childrenWithChildren = children.filter((child) => (byParent.get(child.id) || []).length > 0);
    const groups = childrenWithChildren.map((child) => ({
      [getNodeKey(child)]: buildRecord(child),
    }));

    const record = { collapse: true };
    if (groups.length > 0) {
      record.groups = groups;
    }
    return record;
  }

  const result = {};
  for (const root of rootNodes) {
    const children = byParent.get(root.id) || [];
    if (children.length > 0) {
      result[getNodeKey(root)] = buildRecord(root);
    }
  }
  return result;
}
