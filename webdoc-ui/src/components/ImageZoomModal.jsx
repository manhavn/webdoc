import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  calculateFitScale,
  calculateInitialScale,
  calculateZoomTowardPoint,
  clampScale,
  toggleScale,
  ZOOM_STEP_FACTOR,
} from '../lib/imageZoom'
import { useI18n } from '../i18n/I18nContext'
import { DEFAULT_UI_SETTINGS, useContent } from '../lib/ContentContext'

export default function ImageZoomModal({
  src,
  alt = '',
  naturalWidth = 0,
  naturalHeight = 0,
  onClose,
}) {
  const [dimensions, setDimensions] = useState({
    width: naturalWidth || 0,
    height: naturalHeight || 0,
  })
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })
  const { t } = useI18n()
  const { ui } = useContent()
  const toolbarIdleOpacity =
    ui?.imageZoomToolbarOpacity ?? DEFAULT_UI_SETTINGS.imageZoomToolbarOpacity
  // The toolbar starts fully opaque, holds for 1s, then fades over the last 1s.
  const [toolbarStage, setToolbarStage] = useState('hold')
  const toolbarTimersRef = useRef([])
  const finishToolbarIntro = useCallback(() => {
    toolbarTimersRef.current.forEach((id) => window.clearTimeout(id))
    toolbarTimersRef.current = []
    setToolbarStage('done')
  }, [])
  const overlayRef = useRef(null)
  const imgContainerRef = useRef(null)
  const isPointerDownRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panStartRef = useRef({ x: 0, y: 0 })
  const hasMovedRef = useRef(false)
  const pinchStartRef = useRef(null)
  const initialScaleAppliedRef = useRef(false)

  // Track window resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Lock body scroll while modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Toolbar intro: 1s fully visible, then a 1s fade to the idle opacity. Any
  // hover/focus cancels the remaining intro so leaving hides it immediately.
  useEffect(() => {
    const fade = window.setTimeout(() => setToolbarStage('fade'), 1000)
    const settle = window.setTimeout(() => setToolbarStage('done'), 2000)
    toolbarTimersRef.current = [fade, settle]
    return () => {
      window.clearTimeout(fade)
      window.clearTimeout(settle)
      toolbarTimersRef.current = []
    }
  }, [])

  // Calculate fit scale and initial scale once dimensions and viewport are known
  const fitScale = useMemo(() => {
    return calculateFitScale({
      naturalWidth: dimensions.width,
      naturalHeight: dimensions.height,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
    })
  }, [dimensions.width, dimensions.height, viewport.width, viewport.height])

  useEffect(() => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (!initialScaleAppliedRef.current) {
        const init = calculateInitialScale({
          naturalWidth: dimensions.width,
          naturalHeight: dimensions.height,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        })
        setScale(init)
        setPan({ x: 0, y: 0 })
        initialScaleAppliedRef.current = true
      }
    }
  }, [dimensions.width, dimensions.height, viewport.width, viewport.height])

  const handleImageLoad = (e) => {
    const nw = e.currentTarget.naturalWidth || 0
    const nh = e.currentTarget.naturalHeight || 0
    if (nw > 0 && nh > 0) {
      setDimensions({ width: nw, height: nh })
      if (!initialScaleAppliedRef.current) {
        const init = calculateInitialScale({
          naturalWidth: nw,
          naturalHeight: nh,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
        })
        setScale(init)
        setPan({ x: 0, y: 0 })
        initialScaleAppliedRef.current = true
      }
    }
  }

  // Zoom helpers
  const zoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev * ZOOM_STEP_FACTOR))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => clampScale(prev / ZOOM_STEP_FACTOR))
  }, [])

  const handleToggleFit = useCallback(() => {
    setScale((prev) => {
      const next = toggleScale(prev, fitScale)
      setPan({ x: 0, y: 0 })
      return next
    })
  }, [fitScale])

  const handleReset100 = useCallback(() => {
    setScale(1)
    setPan({ x: 0, y: 0 })
  }, [])

  // Wheel zoom anchored to cursor position
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const handleWheel = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15

      setScale((prevScale) => {
        const targetScale = prevScale * factor
        const centerPoint = {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        }
        const cursorPoint = {
          x: e.clientX,
          y: e.clientY,
        }

        setPan((prevPan) => {
          const result = calculateZoomTowardPoint({
            currentScale: prevScale,
            targetScale,
            currentPan: prevPan,
            cursorPoint,
            centerPoint,
          })
          return result.pan
        })

        return clampScale(targetScale)
      })
    }

    overlay.addEventListener('wheel', handleWheel, { passive: false })
    return () => overlay.removeEventListener('wheel', handleWheel)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        handleToggleFit()
      } else if (e.key === 'ArrowLeft') {
        setPan((p) => ({ ...p, x: p.x + 40 }))
      } else if (e.key === 'ArrowRight') {
        setPan((p) => ({ ...p, x: p.x - 40 }))
      } else if (e.key === 'ArrowUp') {
        setPan((p) => ({ ...p, y: p.y + 40 }))
      } else if (e.key === 'ArrowDown') {
        setPan((p) => ({ ...p, y: p.y - 40 }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, zoomIn, zoomOut, handleToggleFit])

  // Mouse & pointer dragging
  const handlePointerDown = (e) => {
    if (e.button !== 0) return
    isPointerDownRef.current = true
    hasMovedRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    panStartRef.current = { ...pan }
    setIsDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isPointerDownRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true
    }
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    })
  }

  const handlePointerUp = (e) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    setIsDragging(false)
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // Touch pinch to zoom support
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      pinchStartRef.current = {
        distance: Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY),
        scale,
      }
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStartRef.current) {
      e.preventDefault()
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const currentDist = Math.hypot(
        t1.clientX - t2.clientX,
        t1.clientY - t2.clientY,
      )
      const ratio = currentDist / pinchStartRef.current.distance
      setScale(clampScale(pinchStartRef.current.scale * ratio))
    }
  }

  const handleTouchEnd = () => {
    pinchStartRef.current = null
  }

  // Backdrop click closes only if user didn't drag
  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current && !hasMovedRef.current) {
      onClose?.()
    }
  }

  // Double click toggles between fit and 100%
  const handleDoubleClick = (e) => {
    e.stopPropagation()
    handleToggleFit()
  }

  const isAround100 = Math.abs(scale - 1) < 0.04
  const canFit = fitScale < 0.96
  const percentage = Math.round(scale * 100)

  if (typeof document === 'undefined') return null

  const labelClose = t('image.close') !== 'image.close' ? t('image.close') : 'Đóng (Esc)'
  const labelZoomIn = t('image.zoomIn') !== 'image.zoomIn' ? t('image.zoomIn') : 'Phóng to (+)'
  const labelZoomOut = t('image.zoomOut') !== 'image.zoomOut' ? t('image.zoomOut') : 'Thu nhỏ (-)'
  const labelFit = t('image.fit') !== 'image.fit' ? t('image.fit') : 'Thu vừa'
  const labelFitTitle = t('image.fitTitle') !== 'image.fitTitle' ? t('image.fitTitle') : 'Thu vừa màn hình (0)'
  const labelOriginalTitle = t('image.originalTitle') !== 'image.originalTitle' ? t('image.originalTitle') : 'Kích thước thật 100% (0)'
  const labelReset100 = t('image.reset100') !== 'image.reset100' ? t('image.reset100') : 'Bấm để đưa về 100% kích thước thật'

  return createPortal(
    <div
      ref={overlayRef}
      className="wd-image-zoom-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={alt ? `Xem ảnh: ${alt}` : 'Xem ảnh phóng to'}
      onClick={handleBackdropClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Toolbar */}
      <div
        className={`wd-image-zoom-toolbar${
          toolbarStage === 'hold' ? ' is-intro-hold' : ''
        }${toolbarStage === 'fade' ? ' is-intro-fade' : ''}`}
        style={{ '--wd-image-zoom-toolbar-idle-opacity': toolbarIdleOpacity }}
        role="toolbar"
        aria-label="Điều khiển phóng to"
        onClick={(e) => e.stopPropagation()}
        onPointerEnter={finishToolbarIntro}
        onFocusCapture={finishToolbarIntro}
      >
        <button
          type="button"
          className="wd-image-zoom-btn"
          onClick={zoomOut}
          title={labelZoomOut}
          aria-label={labelZoomOut}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35M8 11h6" />
          </svg>
        </button>

        <button
          type="button"
          className="wd-image-zoom-pill"
          onClick={handleReset100}
          title={labelReset100}
          aria-label={`Tỷ lệ ${percentage}%, ${labelReset100}`}
        >
          {percentage}%
        </button>

        <button
          type="button"
          className="wd-image-zoom-btn"
          onClick={zoomIn}
          title={labelZoomIn}
          aria-label={labelZoomIn}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
          </svg>
        </button>

        {canFit && (
          <button
            type="button"
            className="wd-image-zoom-btn wd-image-zoom-btn--text"
            onClick={handleToggleFit}
            title={isAround100 ? labelFitTitle : labelOriginalTitle}
            aria-label={isAround100 ? labelFitTitle : labelOriginalTitle}
          >
            {isAround100 ? (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                </svg>
                <span>{labelFit}</span>
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span>100%</span>
              </>
            )}
          </button>
        )}

        <div className="wd-image-zoom-divider" />

        <button
          type="button"
          className="wd-image-zoom-btn wd-image-zoom-btn--close"
          onClick={onClose}
          title={labelClose}
          aria-label={labelClose}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image Stage */}
      <div
        ref={imgContainerRef}
        className={`wd-image-zoom-stage ${isDragging ? 'is-dragging' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          draggable={false}
          className="wd-image-zoom-img"
          style={{
            width: dimensions.width ? `${dimensions.width}px` : 'auto',
            height: dimensions.height ? `${dimensions.height}px` : 'auto',
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transition: isDragging
              ? 'none'
              : 'transform 0.16s cubic-bezier(0.2, 0, 0, 1)',
            visibility: dimensions.width > 0 ? 'visible' : 'hidden',
          }}
        />
      </div>

      {/* Caption at bottom if alt text present */}
      {alt && (
        <div className="wd-image-zoom-caption" onClick={(e) => e.stopPropagation()}>
          <span>{alt}</span>
        </div>
      )}
    </div>,
    document.body,
  )
}
