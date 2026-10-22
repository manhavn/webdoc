import layoutJson from './layout.json'

export const defaultSite = {
  siteName: 'WebDoc Demo',
  tagline: 'Fictional sample content for product evaluation',
  hotline: '0000 0000',
  email: 'hello@example.com',
  address: '100 Example Avenue, Sample City',
  facebook: 'https://example.com/community',
  youtube: '',
  footerText:
    'Demo content for evaluation only. © 2026 WebDoc Demo.',
  headerLogo: '',
  footerLogo: '',
  favicon: '',
  ogImage: '',
  docsSkipGroups: false,
}

export const defaultLayout = layoutJson

export function mergeLayout(remote) {
  if (!remote || !Array.isArray(remote.sections) || !remote.sections.length) {
    return defaultLayout
  }
  const byKey = new Map(remote.sections.map((s) => [s.key, s]))
  const merged = defaultLayout.sections.map((def) => {
    const hit = byKey.get(def.key)
    if (!hit) return def
    return {
      ...def,
      enabled: hit.enabled !== false,
      order: typeof hit.order === 'number' ? hit.order : def.order,
      data: { ...def.data, ...(hit.data || {}) },
    }
  })
  return { ...defaultLayout, ...remote, sections: merged.sort((a, b) => a.order - b.order) }
}
