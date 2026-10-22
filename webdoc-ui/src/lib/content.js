export function sanitize(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

export function slugifyHeading(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function prepareArticle(raw = '') {
  if (typeof window === 'undefined') return { html: raw, outline: [] }
  const normalized = /<[a-z][\s\S]*>/i.test(raw)
    ? sanitize(raw)
    : raw
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
        .join('')
  const doc = new DOMParser().parseFromString(
    `<div id="__root">${normalized}</div>`,
    'text/html',
  )
  const root = doc.getElementById('__root')
  const outline = []
  const used = new Set()
  root.querySelectorAll('h2, h3').forEach((heading) => {
    const text = heading.textContent.trim()
    if (!text) return
    let id = slugifyHeading(text) || 'muc'
    let suffix = 2
    while (used.has(id)) id = `${slugifyHeading(text)}-${suffix++}`
    used.add(id)
    heading.id = id
    outline.push({
      id,
      text,
      level: Number(heading.tagName.slice(1)),
    })
  })
  return { html: root.innerHTML, outline }
}

