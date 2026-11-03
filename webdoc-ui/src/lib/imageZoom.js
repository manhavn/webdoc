export const MIN_ZOOM_SCALE = 0.1
export const MAX_ZOOM_SCALE = 8.0
export const ZOOM_STEP_FACTOR = 1.25

/**
 * Calculates the scale required to fit an image completely within available viewport bounds.
 */
export function calculateFitScale({
  naturalWidth,
  naturalHeight,
  viewportWidth,
  viewportHeight,
  paddingX = 48,
  paddingY = 64,
}) {
  if (!naturalWidth || !naturalHeight || !viewportWidth || !viewportHeight) {
    return 1
  }
  const availableW = Math.max(viewportWidth - paddingX * 2, 40)
  const availableH = Math.max(viewportHeight - paddingY * 2, 40)

  const scaleX = availableW / naturalWidth
  const scaleY = availableH / naturalHeight
  return Math.min(scaleX, scaleY)
}

/**
 * Computes the default initial scale when opening an image modal.
 * Rules:
 * - If smaller than the available screen area: ALWAYS display at 100% (1.0).
 * - If larger than the available screen area: fit within the viewport (scaleFit < 1.0)
 *   so the full image is visible, capped at 1.0 (never stretched initially).
 */
export function calculateInitialScale({
  naturalWidth,
  naturalHeight,
  viewportWidth,
  viewportHeight,
  paddingX = 48,
  paddingY = 64,
}) {
  if (!naturalWidth || !naturalHeight || !viewportWidth || !viewportHeight) {
    return 1
  }
  const availableW = Math.max(viewportWidth - paddingX * 2, 40)
  const availableH = Math.max(viewportHeight - paddingY * 2, 40)

  const isSmallerThanScreen =
    naturalWidth <= availableW && naturalHeight <= availableH

  if (isSmallerThanScreen) {
    // "mặc định luôn luôn hiển thị 100% kích thước ảnh nếu bé hơn màn hình"
    return 1
  }

  // "nếu quá to so với màn hình thì có zoom"
  const fitScale = calculateFitScale({
    naturalWidth,
    naturalHeight,
    viewportWidth,
    viewportHeight,
    paddingX,
    paddingY,
  })

  return Math.min(fitScale, 1)
}

export function clampScale(scale, min = MIN_ZOOM_SCALE, max = MAX_ZOOM_SCALE) {
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(Math.max(scale, min), max)
}

/**
 * Toggles between 100% (1.0) and fit scale.
 * If currently close to 1.0 and fitScale is significantly less than 1 (larger image),
 * switches to fitScale. Otherwise switches to 1.0.
 */
export function toggleScale(currentScale, fitScale) {
  const isAround100 = Math.abs(currentScale - 1) < 0.04
  const canFit = fitScale < 0.96

  if (isAround100 && canFit) {
    return clampScale(fitScale)
  }
  return 1
}

/**
 * Calculates new pan (x, y) and scale when zooming anchored to a point (such as mouse cursor).
 */
export function calculateZoomTowardPoint({
  currentScale,
  targetScale,
  currentPan,
  cursorPoint,
  centerPoint,
}) {
  const clampedTarget = clampScale(targetScale)
  if (clampedTarget === currentScale || currentScale <= 0) {
    return { scale: clampedTarget, pan: currentPan }
  }

  const ratio = clampedTarget / currentScale
  const dx = cursorPoint.x - centerPoint.x
  const dy = cursorPoint.y - centerPoint.y

  return {
    scale: clampedTarget,
    pan: {
      x: dx - (dx - currentPan.x) * ratio,
      y: dy - (dy - currentPan.y) * ratio,
    },
  }
}
