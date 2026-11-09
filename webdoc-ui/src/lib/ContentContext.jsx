import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { blankSite, fallbackSite } from '../data/defaults'
import { defaultAppearance, mergeAppearance } from '../data/appearance'

/* The shell renders empty until this payload arrives: `site` starts as the
   blank identity and `appearance`/`docsTree` as null, so no bundled sample
   content can flash before the API answers. Bundled values are used only when
   a request fails (`failed`), which is also what restores the demo fallback
   title/logo/favicon. */
export const DEFAULT_UI_SETTINGS = { imageZoomToolbarOpacity: 0.1 }

const ContentContext = createContext({
  site: blankSite,
  appearance: null,
  docsTree: null,
  ui: DEFAULT_UI_SETTINGS,
  loading: true,
  failed: false,
  appearanceLoaded: false,
})

export function ContentProvider({ children }) {

  const [site, setSite] = useState(blankSite)
  const [appearance, setAppearance] = useState(null)
  const [docsTree, setDocsTree] = useState(null)
  const [ui, setUi] = useState(DEFAULT_UI_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [appearanceLoaded, setAppearanceLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.get('/settings/site'),
      api.get('/settings/appearance'),
      api.get('/docs/tree'),
      api.get('/settings/ui'),
    ]).then(([siteRes, appearanceRes, docsRes, uiRes]) => {
      if (!alive) return
      const siteOk = siteRes.status === 'fulfilled' && Boolean(siteRes.value)
      const appearanceOk = appearanceRes.status === 'fulfilled'
      const docsOk =
        docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)
      const opacity = Number(
        uiRes.status === 'fulfilled'
          ? uiRes.value?.imageZoomToolbarOpacity
          : NaN,
      )

      setSite(siteOk ? { ...blankSite, ...siteRes.value } : fallbackSite)
      setAppearance(
        appearanceOk ? mergeAppearance(appearanceRes.value) : defaultAppearance,
      )
      setDocsTree(docsOk ? docsRes.value : [])
      setUi(
        Number.isFinite(opacity) && opacity >= 0 && opacity <= 1
          ? { imageZoomToolbarOpacity: opacity }
          : DEFAULT_UI_SETTINGS,
      )
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
      value={{ site, appearance, docsTree, ui, loading, failed, appearanceLoaded }}
    >
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  return useContext(ContentContext)
}
