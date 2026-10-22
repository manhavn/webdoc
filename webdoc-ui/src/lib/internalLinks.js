import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* Article HTML comes from the CMS, so its anchors are plain <a href="/...">.
   Without interception the browser performs a full document load for every
   link inside an article. This handler routes same-origin clicks through the
   React Router history instead. */
export function isInternalHref(href) {
  return href.startsWith('/') && !href.startsWith('//')
}

export function useInternalLinks() {
  const navigate = useNavigate()

  return useCallback(
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const anchor = event.target.closest?.('a[href]')
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      if ((anchor.getAttribute('rel') || '').split(/\s+/).includes('external')) {
        return
      }

      const href = (anchor.getAttribute('href') || '').trim()
      if (!isInternalHref(href)) return

      const target = new URL(href, window.location.origin)
      if (target.origin !== window.location.origin) return

      // A hash on the current page is an in-document jump; the browser already
      // handles it without reloading, so keep it native.
      if (
        target.pathname === window.location.pathname &&
        target.search === window.location.search
      ) {
        return
      }

      event.preventDefault()
      navigate(`${target.pathname}${target.search}${target.hash}`)
    },
    [navigate],
  )
}
