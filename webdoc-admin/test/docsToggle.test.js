import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeNode, buildTree, ROOT_KEY } from '../src/lib/docsTree.js';

test('normalizeNode preserves and defaults published boolean correctly', () => {
  const nodeWithPublishedTrue = normalizeNode({ id: '1', title: 'Page 1', published: true });
  assert.equal(nodeWithPublishedTrue.published, true);

  const nodeWithPublishedFalse = normalizeNode({ id: '2', title: 'Page 2', published: false });
  assert.equal(nodeWithPublishedFalse.published, false);

  const nodeWithoutPublished = normalizeNode({ id: '3', title: 'Page 3' });
  assert.equal(nodeWithoutPublished.published, true);
});

test('toggling published status updates node state cleanly without mutating tree structure', () => {
  const rawNodes = [
    { id: '1', title: 'Parent', parentId: null, order: 1, published: true },
    { id: '2', title: 'Child 1', parentId: '1', order: 1, published: true },
    { id: '3', title: 'Child 2', parentId: '1', order: 2, published: false },
  ];

  let nodes = rawNodes.map(normalizeNode);
  let tree = buildTree(nodes);

  assert.equal(tree.get(ROOT_KEY).length, 1);
  assert.equal(tree.get('1').length, 2);
  assert.equal(tree.get('1')[0].published, true);
  assert.equal(tree.get('1')[1].published, false);

  // Toggle child 2 to published: true
  nodes = nodes.map((item) => (item.id === '3' ? { ...item, published: !item.published } : item));
  tree = buildTree(nodes);

  assert.equal(tree.get('1')[1].published, true);

  // Toggle parent to published: false
  nodes = nodes.map((item) => (item.id === '1' ? { ...item, published: !item.published } : item));
  tree = buildTree(nodes);

  assert.equal(tree.get(ROOT_KEY)[0].published, false);
});
