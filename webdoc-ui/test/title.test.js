import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDocumentTitle, formatHomeTitle } from '../src/lib/title.js'
import fs from 'node:fs'

test('formatDocumentTitle formats title with siteName', () => {
  assert.equal(
    formatDocumentTitle('Overview', 'WebDoc Demo'),
    'Overview — WebDoc Demo',
  )
  assert.equal(
    formatDocumentTitle('  Overview  ', '  WebDoc Demo  '),
    'Overview — WebDoc Demo',
  )
})

test('formatDocumentTitle handles missing siteName or title', () => {
  assert.equal(formatDocumentTitle('Overview', ''), 'Overview')
  assert.equal(formatDocumentTitle('Overview', null), 'Overview')
  assert.equal(formatDocumentTitle('', 'WebDoc Demo'), 'WebDoc Demo')
  assert.equal(formatDocumentTitle(null, 'WebDoc Demo'), 'WebDoc Demo')
  assert.equal(formatDocumentTitle('', ''), '')
  assert.equal(formatDocumentTitle(null, null), '')
})

test('formatHomeTitle formats homepage title with siteName and tagline', () => {
  assert.equal(
    formatHomeTitle('WebDoc Demo', 'Documentation site'),
    'WebDoc Demo — Documentation site',
  )
  assert.equal(
    formatHomeTitle('  WebDoc Demo  ', '  Documentation site  '),
    'WebDoc Demo — Documentation site',
  )
})

test('formatHomeTitle handles missing siteName or tagline', () => {
  assert.equal(formatHomeTitle('WebDoc Demo', ''), 'WebDoc Demo')
  assert.equal(formatHomeTitle('', 'Documentation site'), 'Documentation site')
  assert.equal(formatHomeTitle('', ''), 'WebDoc')
  assert.equal(formatHomeTitle(null, null), 'WebDoc')
})

test('formatDocumentTitle resolves doc title correctly with doc item', () => {
  const raw = JSON.parse(
    fs.readFileSync(new URL('../src/data/docs.json', import.meta.url), 'utf-8'),
  )
  const overview = raw.find((item) => item.path === '/getting-started/overview')
  assert.ok(overview)
  assert.equal(overview.title, 'Overview')
  assert.equal(
    formatDocumentTitle(overview.title, 'WebDoc Demo'),
    'Overview — WebDoc Demo',
  )
})
