import assert from 'node:assert/strict'
import test from 'node:test'

// Helper replicating the event extraction logic in useImageZoom
function extractImageFromClick(event) {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null

  const img = event.target.closest?.('img')
  if (img) {
    const src = img.currentSrc || img.getAttribute?.('src') || img.src
    if (src) {
      event.preventDefault?.()
      event.stopPropagation?.()
      return {
        src,
        alt: img.getAttribute?.('alt') || img.alt || '',
        naturalWidth: img.naturalWidth || 0,
        naturalHeight: img.naturalHeight || 0,
      }
    }
  }
  return null
}

test('extractImageFromClick detects plain img click and extracts attributes', () => {
  let prevented = false
  let stopped = false

  const imgElement = {
    src: 'https://example.com/photo.png',
    alt: 'Diagram',
    naturalWidth: 1200,
    naturalHeight: 800,
    closest(selector) {
      return selector === 'img' ? this : null
    },
  }

  const event = {
    button: 0,
    target: imgElement,
    preventDefault() {
      prevented = true
    },
    stopPropagation() {
      stopped = true
    },
  }

  const result = extractImageFromClick(event)
  assert.ok(result)
  assert.equal(result.src, 'https://example.com/photo.png')
  assert.equal(result.alt, 'Diagram')
  assert.equal(result.naturalWidth, 1200)
  assert.equal(result.naturalHeight, 800)
  assert.equal(prevented, true)
  assert.equal(stopped, true)
})

test('extractImageFromClick intercepts img wrapped in an anchor link', () => {
  let prevented = false
  let stopped = false

  const anchor = {
    href: '/docs/target',
  }

  const imgElement = {
    src: '/uploads/sample.jpg',
    alt: 'Sample',
    naturalWidth: 400,
    naturalHeight: 300,
    parentElement: anchor,
    closest(selector) {
      if (selector === 'img') return this
      if (selector.includes('a')) return anchor
      return null
    },
  }

  const event = {
    button: 0,
    target: imgElement,
    preventDefault() {
      prevented = true
    },
    stopPropagation() {
      stopped = true
    },
  }

  const result = extractImageFromClick(event)
  assert.ok(result)
  assert.equal(result.src, '/uploads/sample.jpg')
  assert.equal(prevented, true)
  assert.equal(stopped, true)
})

test('extractImageFromClick returns null for non-img clicks (e.g. paragraphs or links)', () => {
  const paragraph = {
    tagName: 'P',
    closest(selector) {
      return null
    },
  }

  const event = {
    button: 0,
    target: paragraph,
    preventDefault() {},
    stopPropagation() {},
  }

  assert.equal(extractImageFromClick(event), null)
})

test('extractImageFromClick ignores non-primary mouse clicks (e.g. right-click) or modified keys', () => {
  const imgElement = {
    src: '/test.png',
    closest(selector) {
      return selector === 'img' ? this : null
    },
  }

  // Right click
  const rightClick = {
    button: 2,
    target: imgElement,
  }
  assert.equal(extractImageFromClick(rightClick), null)

  // Ctrl click
  const ctrlClick = {
    button: 0,
    ctrlKey: true,
    target: imgElement,
  }
  assert.equal(extractImageFromClick(ctrlClick), null)
})
