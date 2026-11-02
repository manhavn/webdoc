import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'
import { defaultSite } from '../data/defaults'
import { defaultAppearance, mergeAppearance } from '../data/appearance'
import { fallbackDocsTree } from './docs'

const ContentContext = createContext({
  site: defaultSite,
  appearance: defaultAppearance,
  docsTree: fallbackDocsTree,
  loading: true,
  appearanceLoaded: false,
})

export function ContentProvider({ children }) {

  const [site, setSite] = useState(defaultSite)
  const [appearance, setAppearance] = useState(defaultAppearance)
  const [docsTree, setDocsTree] = useState(fallbackDocsTree)
  const [loading, setLoading] = useState(true)
  const [appearanceLoaded, setAppearanceLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    Promise.allSettled([
      api.get('/settings/site'),
      api.get('/settings/appearance'),
      api.get('/docs/tree'),
    ]).then(([siteRes, appearanceRes, docsRes]) => {
      if (!alive) return
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
      value={{ site, appearance, docsTree, loading, appearanceLoaded }}
    >
      {children}
    </ContentContext.Provider>
  )
}

export function useContent() {
  return useContext(ContentContext)
}
