import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

function findTarget(hash) {
  if (!hash) return null
  let id = hash.replace(/^#/, '')
  try {
    id = decodeURIComponent(id)
  } catch {
    /* keep the raw id */
  }
  return document.getElementById(id)
}

export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      return undefined
    }

    let stopped = false
    let frame = 0
    const reveal = () => {
      if (stopped) return
      const target = findTarget(hash)
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
