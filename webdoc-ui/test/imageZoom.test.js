import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateFitScale,
  calculateInitialScale,
  clampScale,
  toggleScale,
  calculateZoomTowardPoint,
} from '../src/lib/imageZoom.js'

test('calculateInitialScale returns 1 (100%) when image is smaller than available screen', () => {
  // Screen 1920x1080, paddingX 48, paddingY 64 -> available 1824 x 952
  const viewport = { viewportWidth: 1920, viewportHeight: 1080 }

  // Small image 400x300
  const small = calculateInitialScale({
    naturalWidth: 400,
    naturalHeight: 300,
    ...viewport,
  })
  assert.equal(small, 1)

  // Medium image 800x600 (still smaller than 1824x952)
  const medium = calculateInitialScale({
    naturalWidth: 800,
    naturalHeight: 600,
    ...viewport,
  })
  assert.equal(medium, 1)

  // Exact boundary match
  const boundary = calculateInitialScale({
    naturalWidth: 1824,
    naturalHeight: 952,
    ...viewport,
  })
  assert.equal(boundary, 1)
})

test('calculateInitialScale returns scaleFit (< 1) when image is larger than available screen', () => {
  const viewport = { viewportWidth: 1920, viewportHeight: 1080, paddingX: 48, paddingY: 64 }
  // Available: 1824 x 952

  // Extra wide image: 3648 x 800
  // scaleX = 1824 / 3648 = 0.5; scaleY = 952 / 800 = 1.19 -> min is 0.5
  const wide = calculateInitialScale({
    naturalWidth: 3648,
    naturalHeight: 800,
    ...viewport,
  })
  assert.equal(wide, 0.5)

  // Extra tall image: 800 x 1904
  // scaleX = 1824 / 800 = 2.28; scaleY = 952 / 1904 = 0.5 -> min is 0.5
  const tall = calculateInitialScale({
    naturalWidth: 800,
    naturalHeight: 1904,
    ...viewport,
  })
  assert.equal(tall, 0.5)

  // 4K image: 3840 x 2160
  // scaleX = 1824 / 3840 = 0.475; scaleY = 952 / 2160 = ~0.4407 -> min ~0.4407
  const ultra = calculateInitialScale({
    naturalWidth: 3840,
    naturalHeight: 2160,
    ...viewport,
  })
  assert.ok(ultra < 1)
  assert.ok(Math.abs(ultra - 952 / 2160) < 0.0001)
})

test('calculateInitialScale handles invalid or missing dimensions gracefully', () => {
  assert.equal(calculateInitialScale({ naturalWidth: 0, naturalHeight: 500, viewportWidth: 1920, viewportHeight: 1080 }), 1)
  assert.equal(calculateInitialScale({ naturalWidth: 500, naturalHeight: 0, viewportWidth: 1920, viewportHeight: 1080 }), 1)
  assert.equal(calculateInitialScale({ naturalWidth: null, naturalHeight: null, viewportWidth: 1920, viewportHeight: 1080 }), 1)
})

test('calculateFitScale calculates exact fit proportions', () => {
  const scale = calculateFitScale({
    naturalWidth: 2000,
    naturalHeight: 1000,
    viewportWidth: 1096,
    viewportHeight: 628,
    paddingX: 48,
    paddingY: 64,
  })
  // available: 1000 x 500
  // scaleX = 1000 / 2000 = 0.5; scaleY = 500 / 1000 = 0.5
  assert.equal(scale, 0.5)
})

test('clampScale restricts scale within bounds', () => {
  assert.equal(clampScale(0.01, 0.1, 5.0), 0.1)
  assert.equal(clampScale(10.0, 0.1, 5.0), 5.0)
  assert.equal(clampScale(1.5, 0.1, 5.0), 1.5)
  assert.equal(clampScale(-2), 1)
  assert.equal(clampScale(NaN), 1)
})

test('toggleScale switches between 100% and fit scale', () => {
  const fitScale = 0.45
  // When at 100% (1.0), toggling should switch to fitScale
  assert.equal(toggleScale(1.0, fitScale), fitScale)
  // When at fitScale, toggling should switch to 100% (1.0)
  assert.equal(toggleScale(fitScale, fitScale), 1.0)
  // When zoomed to 2.5, toggling should switch to 100% (1.0)
  assert.equal(toggleScale(2.5, fitScale), 1.0)

  // If image was already smaller than screen (fitScale >= 1.0), toggling stays at 1.0
  assert.equal(toggleScale(1.0, 1.5), 1.0)
})

test('calculateZoomTowardPoint preserves the cursor point relative to the image', () => {
  const result = calculateZoomTowardPoint({
    currentScale: 1.0,
    targetScale: 2.0,
    currentPan: { x: 0, y: 0 },
    cursorPoint: { x: 500, y: 300 },
    centerPoint: { x: 500, y: 300 }, // cursor at center
  })
  assert.equal(result.scale, 2.0)
  assert.deepEqual(result.pan, { x: 0, y: 0 })

  const offCenter = calculateZoomTowardPoint({
    currentScale: 1.0,
    targetScale: 2.0,
    currentPan: { x: 0, y: 0 },
    cursorPoint: { x: 600, y: 300 },
    centerPoint: { x: 500, y: 300 }, // cursor 100px right of center
  })
  assert.equal(offCenter.scale, 2.0)
  // ratio = 2. dx = 100. pan.x = 100 - (100 - 0) * 2 = -100
  assert.equal(offCenter.pan.x, -100)
  assert.equal(offCenter.pan.y, 0)
})
