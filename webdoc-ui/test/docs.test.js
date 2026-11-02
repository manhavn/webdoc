import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDocsTree, findDoc, firstArticlePath } from '../src/lib/docs.js'

test('findDoc returns matching node when published is true or undefined', () => {
  const tree = [
    { path: '/getting-started', title: 'Group', group: true, published: true, children: [] },
    { path: '/page-1', title: 'Page 1', group: false, children: [] },
  ]
  assert.equal(findDoc(tree, '/getting-started')?.title, 'Group')
  assert.equal(findDoc(tree, '/page-1')?.title, 'Page 1')
})

test('findDoc ignores unpublished nodes', () => {
  const tree = [
    { path: '/hidden', title: 'Hidden Page', group: false, published: false, children: [] },
    {
      path: '/group',
      title: 'Group',
      group: true,
      published: true,
      children: [
        { path: '/group/hidden-child', title: 'Hidden Child', group: false, published: false },
        { path: '/group/visible-child', title: 'Visible Child', group: false, published: true },
      ],
    },
  ]
  assert.equal(findDoc(tree, '/hidden'), null)
  assert.equal(findDoc(tree, '/group/hidden-child'), null)
  assert.equal(findDoc(tree, '/group/visible-child')?.title, 'Visible Child')
})

test('firstArticlePath selects the first published leaf article and skips hidden ones', () => {
  const group = {
    path: '/guides',
    title: 'Guides',
    group: true,
    children: [
      { path: '/guides/hidden', title: 'Hidden', group: false, published: false },
      { path: '/guides/first-visible', title: 'Visible', group: false, published: true },
    ],
  }
  assert.equal(firstArticlePath(group), '/guides/first-visible')
})

test('firstArticlePath traverses nested groups to find the first published article', () => {
  const nestedGroup = {
    path: '/docs',
    title: 'Docs',
    group: true,
    children: [
      {
        path: '/docs/subgroup-hidden',
        group: true,
        children: [
          { path: '/docs/subgroup-hidden/p1', group: false, published: false },
        ],
      },
      {
        path: '/docs/subgroup-visible',
        group: true,
        children: [
          { path: '/docs/subgroup-visible/article-1', group: false, published: true },
        ],
      },
    ],
  }
  assert.equal(firstArticlePath(nestedGroup), '/docs/subgroup-visible/article-1')
})

test('firstArticlePath returns null when all children are hidden or group has no articles', () => {
  const emptyGroup = {
    path: '/empty',
    title: 'Empty',
    group: true,
    children: [
      { path: '/empty/p1', group: false, published: false },
      { path: '/empty/p2', group: false, published: false },
    ],
  }
  assert.equal(firstArticlePath(emptyGroup), null)
})

test('buildDocsTree does not promote orphaned children to roots when parent is missing', () => {
  const flat = [
    { path: '/orphan-child', title: 'Orphan Child', parentPath: '/missing-parent', order: 1 },
    { path: '/root-page', title: 'Root Page', parentPath: null, order: 2 },
  ]
  const tree = buildDocsTree(flat)
  assert.equal(tree.length, 1)
  assert.equal(tree[0].path, '/root-page')
})
