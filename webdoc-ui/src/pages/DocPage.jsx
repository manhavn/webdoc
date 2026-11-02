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
import { formatDocumentTitle } from '../lib/title'

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
  const { docsTree, site, loading: contentLoading } = useContent()
  const { t } = useI18n()
  const onInternalClick = useInternalLinks()
  const { setLoading: setRouteLoading } = useRouteProgress()
  const [doc, setDoc] = useState(null)
  const [loading, setLoading] = useState(true)

  const docLinks = useMemo(() => flattenDocs(docsTree), [docsTree])
  const fallbackLinks = useMemo(() => flattenDocs(fallbackDocsTree), [])
  const links = docLinks.length > 0 ? docLinks : fallbackLinks
  const skipGroups = Boolean(site.docsSkipGroups)

  const treeNode = useMemo(
    () => findDoc(docsTree, path) || fallbackDoc(path),
    [docsTree, path],
  )
  const isGroup = Boolean(treeNode?.group)
  const firstArticle = useMemo(() => {
    if (!skipGroups) return null
    if (isGroup) {
      const fromTree = firstArticlePath(treeNode)
      if (fromTree) return fromTree
    }
    const prefixMatch = links.find(
      (item) => !item.group && item.link && item.link.startsWith(path + '/'),
    )
    return prefixMatch ? prefixMatch.link : null
  }, [skipGroups, isGroup, treeNode, links, path])
  useEffect(() => {
    if (contentLoading) return

    if (skipGroups && (isGroup || firstArticle)) {
      if (!firstArticle) {
        setDoc(null)
        setLoading(false)
      }
      return
    }

    let alive = true
    setLoading(true)
    api
      .get(`/docs/page?path=${encodeURIComponent(path)}`)
      .then((res) => {
        if (!alive) return
        if (skipGroups && res?.group) {
          const target =
            firstArticlePath(findDoc(docsTree, res.path)) ||
            firstArticlePath(res)
          if (target) {
            setDoc(null)
            return
          }
        }
        setDoc({ ...res, source: 'api' })
      })
      .catch((error) => {
        if (!alive) return
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
  }, [path, contentLoading, skipGroups, isGroup, firstArticle, docsTree])
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

  useEffect(() => {
    if (skipGroups) {
      const node = findDoc(docsTree, path) || fallbackDoc(path)
      if (node && node.group) return
    }
    const current =
      (doc && doc.path === path ? doc : null) ||
      findDoc(docsTree, path) ||
      fallbackDoc(path) ||
      doc
    if (!current) return
    const pageTitle = current.title?.trim() || t('doc.defaultTitle')
    document.title = formatDocumentTitle(pageTitle, site.siteName)
  }, [doc, docsTree, path, skipGroups, site.siteName, t])
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

  if (contentLoading) {
    return (
      <DocsLayout contentKey="loading">
        <DocSkeleton label={t('doc.loading')} />
      </DocsLayout>
    )
  }

  if (skipGroups && (isGroup || firstArticle)) {
    if (firstArticle) {
      return (
        <DocsLayout contentKey="loading">
          <DocSkeleton label={t('doc.loading')} />
          <Navigate to={firstArticle} replace />
        </DocsLayout>
      )
    }
    return <NotFound />
  }

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

  if (skipGroups && doc.group) {
    const first =
      firstArticlePath(findDoc(docsTree, doc.path)) || firstArticlePath(doc)
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
