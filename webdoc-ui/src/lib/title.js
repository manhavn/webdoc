export function formatDocumentTitle(pageTitle, siteName) {
  const title = (pageTitle || '').trim()
  const brand = (siteName || '').trim()
  if (title && brand) {
    return `${title} — ${brand}`
  }
  return title || brand || ''
}

export function formatHomeTitle(siteName, tagline) {
  const brand = (siteName || '').trim()
  const tag = (tagline || '').trim()
  if (brand && tag) {
    return `${brand} — ${tag}`
  }
  return brand || tag || 'WebDoc'
}
