import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { blankSite, fallbackSite } from '../data/defaults'
import { defaultAppearance, mergeAppearance } from '../data/appearance'

/* The shell renders empty until this payload arrives: `site` starts as the
   blank identity and `appearance`/`docsTree` as null, so no bundled sample
   content can flash before the API answers. Bundled values are used only when
   a request fails (`failed`), which is also what restores the demo fallback
   title/logo/favicon. */
const ContentContext = createContext({
  site: blankSite,
  appearance: null,
  docsTree: null,
  loading: true,
  failed: false,
  appearanceLoaded: false,
})

export function ContentProvider({ children }) {

  const [site, setSite] = useState(blankSite)
  const [appearance, setAppearance] = useState(null)
  const [docsTree, setDocsTree] = useState(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [appearanceLoaded, setAppearanceLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.get('/settings/site'),
      api.get('/settings/appearance'),
      api.get('/docs/tree'),
    ]).then(([siteRes, appearanceRes, docsRes]) => {
      if (!alive) return
      const siteOk = siteRes.status === 'fulfilled' && Boolean(siteRes.value)
      const appearanceOk = appearanceRes.status === 'fulfilled'
      const docsOk =
        docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)

      setSite(siteOk ? { ...blankSite, ...siteRes.value } : fallbackSite)
      setAppearance(
        appearanceOk ? mergeAppearance(appearanceRes.value) : defaultAppearance,
      )
      setDocsTree(docsOk ? docsRes.value : [])
      setAppearanceLoaded(appearanceOk)
      setFailed(!siteOk || !appearanceOk || !docsOk)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ContentContext.Provider
      value={{ site, appearance, docsTree, loading, failed, appearanceLoaded }}
    >
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  return useContext(ContentContext)
}
