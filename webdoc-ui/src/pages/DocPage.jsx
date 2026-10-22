import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useContent } from '../lib/ContentContext'
import {
  fallbackDocsFlat,
  fallbackDocsTree,
  findDoc,
  firstArticlePath,
  flattenDocs,
  normalizeDocPath,
} from '../lib/docs'
import { prepareArticle } from '../lib/content'
import { useInternalLinks } from '../lib/internalLinks'
import { useRouteProgress } from '../lib/routeProgress'
import DocsLayout from '../components/DocsLayout'
import NotFound from './NotFound'
import { useI18n } from '../i18n/I18nContext'

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

function DocSkeleton({ label }) {
  return (
    <div
      className="wd-doc-loading"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="wd-skel-line wd-skel-title" />
      <div className="wd-skel-line short" />
      <div className="wd-skel-block" />
      <div className="wd-skel-line" />
      <div className="wd-skel-line" />
      <div className="wd-skel-line short" />
    </div>
  )
}

export default function DocPage() {
  const params = useParams()
  const path = normalizeDocPath(params['*'])
  const { docsTree, site } = useContent()
  const { t } = useI18n()
  const onInternalClick = useInternalLinks()
  const { setLoading: setRouteLoading } = useRouteProgress()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // The previous article stays mounted (see the loading branch below) so the
    // swap has nothing to blank out; only the header bar reports the fetch.
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
        setDoc(local ? { ...local, source: 'fallback' } : null)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [path])

  // A switch is in flight only when there is an article on screen to keep.
  const swapping = loading && Boolean(doc)
  useEffect(() => {
    setRouteLoading(swapping)
  }, [setRouteLoading, swapping])
  useEffect(() => () => setRouteLoading(false), [setRouteLoading])

  const prepared = useMemo(
    () => prepareArticle(doc?.content || ''),
    [doc?.content],
  )

  const docLinks = useMemo(() => flattenDocs(docsTree), [docsTree])
  const fallbackLinks = useMemo(() => flattenDocs(fallbackDocsTree), [])
  const links = docLinks.length > 0 ? docLinks : fallbackLinks
  const skipGroups = Boolean(site.docsSkipGroups)
  // Group pages are containers when the option is on, so they never appear in
  // the previous/next sequence: moving past a group edge lands on the last
  // article of the previous group or the first article of the next one.
  const navLinks = skipGroups ? links.filter((item) => !item.group) : links
  // Prev/next follow the article that is actually on screen. During a switch
  // that is still the previous article, so the footer never mixes two pages.
  const displayPath = doc?.path || path
  const index = navLinks.findIndex((item) => item.link === displayPath)
  const prev = index > 0 ? navLinks[index - 1] : null
  const next =
    index >= 0 && index < navLinks.length - 1 ? navLinks[index + 1] : null

  const group = Boolean(doc?.group)
  const children = doc?.children || []

  if (loading && !doc) {
    return (
      <DocsLayout contentKey="loading">
        <DocSkeleton label={t('doc.loading')} />
      </DocsLayout>
    )
  }

  if (!doc) {
    return <NotFound />
  }

  // With the option on a group is not a destination: open the first article of
  // the innermost nested group. A group without any article returns 404. The
  // docs shell stays mounted during the redirect: returning a bare Navigate
  // would unmount it for a frame and leak the marketing footer.
  if (skipGroups && doc.group) {
    const first = firstArticlePath(doc)
    if (!first) return <NotFound />
    return (
      <DocsLayout contentKey="loading">
        <DocSkeleton label={t('doc.loading')} />
        <Navigate to={first} replace />
      </DocsLayout>
    )
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
      contentKey={displayPath}
      contentPath={doc?.path || null}
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
