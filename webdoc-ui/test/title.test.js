import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDocumentTitle, formatHomeTitle } from '../src/lib/title.js'

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
