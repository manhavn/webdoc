import { useCallback, useState } from 'react'
import { useInternalLinks } from './internalLinks'

/**
 * Hook to handle image zoom click events in article / group content.
 * Intercepts clicks on <img> elements to open in the zoom modal,
 * while forwarding other link clicks to internal link navigation.
 */
export function useImageZoom() {
  const [zoomImage, setZoomImage] = useState(null)
  const onInternalClick = useInternalLinks()

  const handleContentClick = useCallback(
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const img = event.target.closest?.('img')
      if (img) {
        const src = img.currentSrc || img.getAttribute('src') || img.src
        if (src) {
          event.preventDefault()
          event.stopPropagation()
          setZoomImage({
            src,
            alt: img.getAttribute('alt') || img.alt || '',
            naturalWidth: img.naturalWidth || 0,
            naturalHeight: img.naturalHeight || 0,
          })
          return
        }
      }

      onInternalClick(event)
    },
    [onInternalClick],
  )

  const closeZoom = useCallback(() => {
    setZoomImage(null)
  }, [])

  return {
    zoomImage,
    handleContentClick,
    closeZoom,
  }
}
