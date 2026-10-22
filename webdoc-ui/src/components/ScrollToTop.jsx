import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { normalizeDocPath } from '../lib/docs'

function findTarget(hash, pathname) {
  if (!hash) return null
  let id = hash.replace(/^#/, '')
  try {
    id = decodeURIComponent(id)
  } catch {
    /* keep the raw id */
  }
  const target = document.getElementById(id)
  if (!target) return null
  // The previous article stays mounted while the next one downloads. A stale
  // heading with the same id must not stop the reveal before the target
  // article has rendered.
  const articlePath = target.closest('.wd-doc-content')?.dataset.docPath
  if (
    articlePath &&
    normalizeDocPath(articlePath) !== normalizeDocPath(pathname)
  ) {
    return null
  }
  return target
}

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  // Before paint: using useEffect here paints the new route at the previous
  // scroll offset for one frame, which flashes the old page bottom/footer.
  useLayoutEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      return undefined
    }

    let stopped = false
    let frame = 0
    const reveal = () => {
      if (stopped) return
      const target = findTarget(hash, pathname)
      if (!target) return
      stopped = true
      observer.disconnect()
      cancelAnimationFrame(frame)
      target.scrollIntoView({ behavior: 'auto', block: 'start' })
    }
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reveal)
    })

    reveal()
    if (!stopped) {
      // Article content arrives after the route mounts; wait for its heading.
      observer.observe(document.body, { childList: true, subtree: true })
    }

    return () => {
      stopped = true
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [pathname, hash])

  return null
}
