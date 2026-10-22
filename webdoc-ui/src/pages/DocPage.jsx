import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useContent } from '../lib/ContentContext'
import {
  fallbackDocsFlat,
  fallbackDocsTree,
  findDoc,
  flattenDocs,
} from '../lib/docs'
import { prepareArticle } from '../lib/content'
import { useInternalLinks } from '../lib/internalLinks'
import DocsLayout from '../components/DocsLayout'
import NotFound from './NotFound'
import { useI18n } from '../i18n/I18nContext'

function normalizePath(value) {
  const path = '/' + String(value || '').replace(/^\/+|\/+$/g, '')
  return path === '/' ? '/' : path.replace(/\/+$/g, '')
}

function plainText(value = '') {
  if (typeof document === 'undefined') return value
  const element = document.createElement('div')
  element.innerHTML = value
  return element.textContent.replace(/\s+/g, ' ').trim()
}

function fallbackDoc(path) {
  const node = findDoc(fallbackDocsTree, path)
  if (node) return node
  const flat = fallbackDocsFlat.find((item) => item.path === path)
  return flat || null
}

export default function DocPage() {
  const params = useParams()
  const path = normalizePath(params['*'])
  const { docsTree } = useContent()
  const { t } = useI18n()
  const onInternalClick = useInternalLinks()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setDoc(null)
    api
      .get(`/docs/page?path=${encodeURIComponent(path)}`)
      .then((res) => {
        if (alive) setDoc({ ...res, source: 'api' })
      })
      .catch((error) => {
        if (!alive) return
        // A 404 means the database has no such page. Only use bundled demo
        // content when the API itself is unreachable, so an empty install
        // does not silently show sample articles.
        if (error && error.status === 404) {
          setDoc(null)
          return
        }
        const local = fallbackDoc(path)
        if (local) setDoc({ ...local, source: 'fallback' })
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [path])

  const prepared = useMemo(
    () => prepareArticle(doc?.content || ''),
    [doc?.content],
  )

  const docLinks = useMemo(() => flattenDocs(docsTree), [docsTree])
  const fallbackLinks = useMemo(() => flattenDocs(fallbackDocsTree), [])
  const links = docLinks.length > 0 ? docLinks : fallbackLinks
  const index = links.findIndex((item) => item.link === path)
  const prev = index > 0 ? links[index - 1] : null
  const next = index >= 0 && index < links.length - 1 ? links[index + 1] : null

  const group = Boolean(doc?.group)
  const children = doc?.children || []

  if (loading) {
    return (
      <DocsLayout contentKey="loading">
        <div
          className="wd-doc-loading"
          role="status"
          aria-label={t('doc.loading')}
          aria-busy="true"
        >
          <div className="wd-skel-line wd-skel-title" />
          <div className="wd-skel-line short" />
          <div className="wd-skel-block" />
          <div className="wd-skel-line" />
          <div className="wd-skel-line" />
          <div className="wd-skel-line short" />
        </div>
      </DocsLayout>
    )
  }

  if (!doc) {
    return <NotFound />
  }

  const title = doc?.title || t('doc.defaultTitle')
  const description = doc?.description || ''
  const firstParagraph = (prepared.html || '').match(/^\s*<p>([\s\S]*?)<\/p>/i)
  const duplicateLead =
    Boolean(description) &&
    Boolean(firstParagraph) &&
    plainText(firstParagraph[1]) === plainText(description)
  const asideLinks = group
    ? children.map((child) => ({
        label: child.title,
        href: child.path,
        active: false,
      }))
    : []
  const outline = group ? [] : prepared.outline

  return (
    <DocsLayout
      contentKey={path}
      animateContent
      outline={outline}
      asideTitle={group ? t('doc.contents') : t('doc.onThisPage')}
      asideLinks={asideLinks}
      footer={
        <div className="wd-doc-nav-footer">
          {prev && (
            <Link className="wd-doc-nav" to={prev.link}>
              <span>{t('doc.prev')}</span>
              <strong>{prev.title}</strong>
            </Link>
          )}
          {next && (
            <Link className="wd-doc-nav wd-doc-nav--next" to={next.link}>
              <span>{t('doc.next')}</span>
              <strong>{next.title}</strong>
            </Link>
          )}
        </div>
      }
    >
      <h1>{title}</h1>
      {description && !duplicateLead && (
        <p className="wd-article-lead">{description}</p>
      )}

      {doc && (
        <>
          {prepared.html && (
            <div onClick={onInternalClick} dangerouslySetInnerHTML={{ __html: prepared.html }} />
          )}
          {children.length > 0 && (
            <>
              <h2 id="cac-huong-dan">
                {group ? t('doc.guides') : t('doc.related')}
              </h2>
              <ul className="wd-doc-link-list">
                {children.map((child) => (
                  <li key={child.id || child.path}>
                    <Link to={child.path}>
                      <i className="fas fa-plus" />
                      <span>{child.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </DocsLayout>
  )
}
