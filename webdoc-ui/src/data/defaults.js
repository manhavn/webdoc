import layoutJson from './layout.json'

export const defaultSite = {
  siteName: 'WebDoc',
  tagline: 'Scientific publishing demo',
  hotline: '0912 345 678',
  email: 'hello@example.com',
  address:
    '1 Demo Street, Hanoi, Vietnam',
  facebook: 'https://facebook.com/example',
  youtube: 'https://www.youtube.com/@example',
  footerText:
    'WebDoc — for evaluation only. © 2026 WebDoc.',
  headerLogo: '',
  footerLogo: '',
  favicon: '',
  ogImage: '',
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
