import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { defaultLayout, defaultSite, mergeLayout } from '../data/defaults'
import { defaultAppearance, mergeAppearance } from '../data/appearance'
import { fallbackDocsTree } from './docs'

const ContentContext = createContext({
  layout: defaultLayout,
  site: defaultSite,
  appearance: defaultAppearance,
  docsTree: fallbackDocsTree,
  loading: true,
  appearanceLoaded: false,
})

export function ContentProvider({ children }) {
  const [layout, setLayout] = useState(defaultLayout)
  const [site, setSite] = useState(defaultSite)
  const [appearance, setAppearance] = useState(defaultAppearance)
  const [docsTree, setDocsTree] = useState(fallbackDocsTree)
  const [loading, setLoading] = useState(true)
  const [appearanceLoaded, setAppearanceLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.get('/settings/layout'),
      api.get('/settings/site'),
      api.get('/settings/appearance'),
      api.get('/docs/tree'),
    ]).then(([layoutRes, siteRes, appearanceRes, docsRes]) => {
      if (!alive) return
      if (layoutRes.status === 'fulfilled') {
        setLayout(mergeLayout(layoutRes.value))
      }
      if (siteRes.status === 'fulfilled' && siteRes.value) {
        setSite({ ...defaultSite, ...siteRes.value })
      }
      if (appearanceRes.status === 'fulfilled') {
        setAppearance(mergeAppearance(appearanceRes.value))
        setAppearanceLoaded(true)
      }
      if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) {
        setDocsTree(docsRes.value)
      }
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <ContentContext.Provider
      value={{ layout, site, appearance, docsTree, loading, appearanceLoaded }}
    >
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  return useContext(ContentContext)
}
