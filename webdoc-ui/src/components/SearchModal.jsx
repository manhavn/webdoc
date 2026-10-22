import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../lib/ContentContext'
import { flattenDocs } from '../lib/docs'
import { localizedLabel } from '../data/appearance'
import { useI18n } from '../i18n/I18nContext'

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const { docsTree, appearance } = useContent()
  const { t, lang } = useI18n()
  const docs = useMemo(() => flattenDocs(docsTree), [docsTree])
  const quickLinks = useMemo(() => {
    const out = []
    for (const item of appearance.navigation || []) {
      if (item.href) out.push({ path: item.href, title: localizedLabel(item, lang) })
      for (const child of item.links || []) {
        if (child.href) {
          out.push({ path: child.href, title: localizedLabel(child, lang) })
        }
      }
    }
    return out
  }, [appearance.navigation, lang])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const items = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return quickLinks
    return docs
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.link.toLowerCase().includes(q) ||
          item.parents.join(' ').toLowerCase().includes(q),
      )
      .slice(0, 10)
      .map((item) => ({
        title: item.title,
        path: item.link,
        caption: item.parents.join(' › '),
      }))
  }, [query, docs, quickLinks])

  if (!open) return null

  const go = (path) => {
    onClose()
    navigate(path)
  }

  return (
    <div
      className="wd-search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t('search.aria')}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="wd-search-panel">
        <div className="wd-search-input">
          <span className="vp-icon DocSearch-Search-Icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && items[0]) go(items[0].path)
            }}
          />
          <button type="button" className="wd-search-esc" onClick={onClose}>
            ESC
          </button>
        </div>
        <div className="wd-search-results">
          <p className="wd-search-label">
            {query.trim() ? t('search.results') : t('search.quickLinks')}
          </p>
          {items.length === 0 && (
            <p className="wd-search-empty">{t('search.empty')}</p>
          )}
          {items.map((item) => (
            <button
              type="button"
              key={item.path}
              className="wd-search-item"
              onClick={() => go(item.path)}
            >
              <span className="wd-search-item-title">{item.title}</span>
              {item.caption && (
                <span className="wd-search-item-caption">{item.caption}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
