import assert from 'node:assert/strict';
import test from 'node:test';
import {
  setNodeCollapsed,
  pruneTree,
  collectCollapsedIds,
  buildCollapseAllTree,
  getAncestorKeys,
} from '../src/lib/collapseTree.js';

test('collapse tree matches user example structure exactly', () => {
  let tree = {};

  // nhom-cha-1 has child nhom-con-3 collapsed (parent 1 is not collapsed)
  tree = setNodeCollapsed(tree, ['nhom-cha-1'], 'nhom-con-3', true);

  // nhom-cha-5 is collapsed and child nhom-con-6 is also collapsed
  tree = setNodeCollapsed(tree, ['nhom-cha-5'], 'nhom-con-6', true);
  tree = setNodeCollapsed(tree, [], 'nhom-cha-5', true);

  const expected = JSON.stringify({
    'nhom-cha-1': {
      groups: [{ 'nhom-con-3': { collapse: true } }],
    },
    'nhom-cha-5': {
      collapse: true,
      groups: [{ 'nhom-con-6': { collapse: true } }],
    },
  });

  assert.equal(JSON.stringify(tree), expected);
});

test('uncollapsing parent retains child collapsed state in groups', () => {
  let tree = {
    'nhom-cha-5': {
      collapse: true,
      groups: [{ 'nhom-con-6': { collapse: true } }],
    },
  };

  // Expand parent 5
  tree = setNodeCollapsed(tree, [], 'nhom-cha-5', false);

  const expected = JSON.stringify({
    'nhom-cha-5': {
      groups: [{ 'nhom-con-6': { collapse: true } }],
    },
  });

  assert.equal(JSON.stringify(tree), expected);
  assert.equal(tree['nhom-cha-5'].collapse, undefined);
  assert.equal(tree['nhom-cha-5'].groups[0]['nhom-con-6'].collapse, true);
});

test('uncollapsing all children removes parent key when parent is not collapsed', () => {
  let tree = {
    'nhom-cha-1': {
      groups: [{ 'nhom-con-3': { collapse: true } }],
    },
  };

  // Expand child 3
  tree = setNodeCollapsed(tree, ['nhom-cha-1'], 'nhom-con-3', false);

  assert.deepEqual(tree, {});
});

test('uncollapsing child retains parent key if parent is collapsed', () => {
  let tree = {
    'nhom-cha-5': {
      collapse: true,
      groups: [{ 'nhom-con-6': { collapse: true } }],
    },
  };

  // Expand child 6
  tree = setNodeCollapsed(tree, ['nhom-cha-5'], 'nhom-con-6', false);

  assert.deepEqual(tree, {
    'nhom-cha-5': { collapse: true },
  });
});

test('collectCollapsedIds correctly maps IDs in memory', () => {
  const nodes = [
    { id: 'id-1', slug: 'nhom-cha-1', parentId: null },
    { id: 'id-2', slug: 'nhom-con-2', parentId: 'id-1' },
    { id: 'id-3', slug: 'nhom-con-3', parentId: 'id-1' },
    { id: 'id-5', slug: 'nhom-cha-5', parentId: null },
    { id: 'id-6', slug: 'nhom-con-6', parentId: 'id-5' },
  ];

  const tree = {
    'nhom-cha-1': {
      groups: [{ 'nhom-con-3': { collapse: true } }],
    },
    'nhom-cha-5': {
      collapse: true,
      groups: [{ 'nhom-con-6': { collapse: true } }],
    },
  };

  const collapsedIds = collectCollapsedIds(tree, nodes);
  assert.equal(collapsedIds.has('id-1'), false);
  assert.equal(collapsedIds.has('id-2'), false);
  assert.equal(collapsedIds.has('id-3'), true);
  assert.equal(collapsedIds.has('id-5'), true);
  assert.equal(collapsedIds.has('id-6'), true);
});

test('getAncestorKeys traces hierarchy from root to parent', () => {
  const nodes = [
    { id: '1', slug: 'root', parentId: null },
    { id: '2', slug: 'level-1', parentId: '1' },
    { id: '3', slug: 'level-2', parentId: '2' },
  ];

  assert.deepEqual(getAncestorKeys('1', nodes), []);
  assert.deepEqual(getAncestorKeys('2', nodes), ['root']);
  assert.deepEqual(getAncestorKeys('3', nodes), ['root', 'level-1']);
});
