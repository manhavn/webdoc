import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useContent } from '../lib/ContentContext'
import { firstArticlePath } from '../lib/docs'
import { useI18n } from '../i18n/I18nContext'

function nodeKey(item, level) {
  return level === 0 ? item.text : item.link || item.text
}

function linkActive(item, activePath) {
  if (!item.link) return false
  if (item.link === '/bai-viet') {
    return activePath === '/bai-viet' || activePath.startsWith('/bai-viet/')
  }
  return activePath === item.link
}

function containsActive(items, activePath) {
  return items.some((item) => {
    if (linkActive(item, activePath)) return true
    return item.items ? containsActive(item.items, activePath) : false
  })
}

function SidebarItem({
  item,
  level,
  activePath,
  activeCategory,
  openGroups,
  animatedGroups,
  toggle,
  onNavigate,
}) {
  const { t } = useI18n()
  const hasItems = Boolean(item.items && item.items.length)
  const isActive = linkActive(item, activePath)
  const childActive = hasItems && containsActive(item.items, activePath)
  const branchActive = isActive || childActive
  const key = nodeKey(item, level)
  const groupOpen = hasItems && (openGroups[key] ?? item.open ?? branchActive)

  const itemClass = [
    'VPSidebarItem',
    `level-${level}`,
    hasItems ? 'collapsible' : '',
    item.link ? 'is-link' : '',
    isActive ? 'is-active' : '',
    branchActive ? 'has-active' : '',
    hasItems && !groupOpen ? 'collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const Tag = level === 0 ? 'section' : 'div'
  const textTag = level === 0 ? 'h2' : 'p'

  return (
    <Tag className={itemClass} data-v-a65f323b="" data-v-5e427630="">
      <div className="item" data-v-5e427630="" tabIndex={0}>
        <div className="indicator" data-v-5e427630="" />
        {item.link ? (
          <Link
            className="VPLink link link"
            data-v-5e427630=""
            to={item.link}
            onClick={onNavigate}
          >
            {textTag === 'h2' ? (
              <h2 className="text" data-v-5e427630="">
                {item.text}
              </h2>
            ) : (
              <p className="text" data-v-5e427630="">
                {item.text}
              </p>
            )}
          </Link>
        ) : (
          <span
            className="VPLink link"
            data-v-5e427630=""
            onClick={() => hasItems && toggle(key, !groupOpen)}
          >
            <p className="text" data-v-5e427630="">
              {item.text}
            </p>
          </span>
        )}
        {hasItems && (
          <div
            className="caret"
            role="button"
            aria-label={t('docs.toggleSection')}
            aria-expanded={groupOpen}
            tabIndex={0}
            data-v-5e427630=""
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              toggle(key, !groupOpen)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle(key)
              }
            }}
          >
            <span
              className="vpi-chevron-right caret-icon"
              data-v-5e427630=""
            />
          </div>
        )}
      </div>
      {hasItems && (
        <div
          className={`items${groupOpen ? ' is-open' : ' is-collapsed'}${
            animatedGroups[key] ? ' is-animated' : ''
          }`}
          data-v-5e427630=""
          aria-hidden={!groupOpen}
        >
          <div className="items-inner">
            {item.items.map((child) => (
              <SidebarItem
                key={nodeKey(child, level + 1)}
                item={child}
                level={level + 1}
                activePath={activePath}
                activeCategory={activeCategory}
                openGroups={openGroups}
                animatedGroups={animatedGroups}
                toggle={toggle}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      )}
    </Tag>
  )
}

function docToSidebar(node, level = 0, skipGroups = false) {
  const link =
    skipGroups && node.group
      ? firstArticlePath(node) || node.path
      : node.path
  return {
    text: node.title,
    link,
    order: node.order,
    items: (node.children || []).map((child) =>
      docToSidebar(child, level + 1, skipGroups),
    ),
  }
}

function Sidebar({ activePath, activeCategory, open, onNavigate }) {
  const { docsTree, site } = useContent()
  const { t } = useI18n()
  const skipGroups = Boolean(site.docsSkipGroups)
  const groups = useMemo(
    () =>
      [...docsTree]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((node) => docToSidebar(node, 0, skipGroups)),
    [docsTree, skipGroups],
  )

  const initialOpen = () => ({})
  const [openGroups, setOpenGroups] = useState(initialOpen)
  // Groups opened by navigation render without a transition: animating them
  // while the article loads is what reads as a flash. Manual toggles keep the
  // existing slide animation.
  const [animatedGroups, setAnimatedGroups] = useState({})

  // Open the branch that contains the current page, but never force groups
  // closed: closing a group during navigation animates in the opposite
  // direction to the group being opened and reads as a flicker.
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev }
      let changed = false
      const open = (key) => {
        if (next[key]) return
        next[key] = true
        changed = true
      }
      const walk = (items, level) => {
        items.forEach((item) => {
          if (!item.items) return
          if (
            linkActive(item, activePath) ||
            containsActive(item.items, activePath)
          ) {
            open(nodeKey(item, level))
          }
          walk(item.items, level + 1)
        })
      }
      walk(groups, 0)
      return changed ? next : prev
    })
  }, [activePath, groups])

  const toggle = (key, open) => {
    setAnimatedGroups((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
    setOpenGroups((prev) => ({ ...prev, [key]: open }))
  }

  return (
    <aside
      className={`VPSidebar${open ? ' open' : ''}`}
      data-v-f5dfc737=""
      data-v-7a35448c=""
    >
      <div className="curtain" data-v-7a35448c="" />
      <nav
        className="nav"
        id="VPSidebarNav"
        aria-labelledby="sidebar-aria-label"
        tabIndex={-1}
        data-v-7a35448c=""
      >
        <span
          className="visually-hidden"
          id="sidebar-aria-label"
          data-v-7a35448c=""
        >
          {t('docs.sidebarNavigation')}
        </span>
        {groups.map((group, index) => (
          <div
            className={`${index === 0 ? 'no-transition ' : ''}group`}
            data-v-a65f323b=""
            key={group.text}
          >
            <SidebarItem
              item={group}
              level={0}
              activePath={activePath}
              activeCategory={activeCategory}
              openGroups={openGroups}
              animatedGroups={animatedGroups}
              toggle={toggle}
              onNavigate={onNavigate}
            />
          </div>
        ))}
      </nav>
    </aside>
  )
}

function AsideLinks({ title, links }) {
  if (!links || links.length === 0) return null
  return (
    <nav
      aria-label={title}
      className="VPDocAsideOutline has-outline"
      data-v-03ead402=""
      data-v-7b6afc09=""
    >
      <div className="content" data-v-7b6afc09="">
        <div className="outline-title" data-v-7b6afc09="">
          {title}
        </div>
        <ul className="VPDocOutlineItem root" data-v-7b6afc09="" data-v-91e7bc45="">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                className={`outline-link${link.active ? ' active' : ''}`}
                data-v-91e7bc45=""
                to={link.href}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

/* Headings carry `scroll-margin-top: nav + 24px`, so a heading is "current"
   once its top edge passes this line. */
const OUTLINE_OFFSET = 96

/* Mirror the active section into the address bar. Only same-document anchors
   are touched here: navigating to another article stays owned by React Router,
   which drops the hash on its own. */
function syncOutlineHash(id) {
  const { pathname, search, hash } = window.location
  const nextHash = id ? `#${id}` : ''
  if (hash === nextHash) return
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}${nextHash}`,
  )
}

function readHashId() {
  const raw = window.location.hash.replace(/^#/, '')
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function Outline({ items }) {
  const { t, lang } = useI18n()
  const [active, setActive] = useState('')
  const activeRef = useRef('')
  // Set on a TOC click so the smooth scroll below does not flicker the active
  // item through every section it passes. Released on the next real scroll
  // gesture, after which the scroll position owns the active state again.
  const pinnedRef = useRef(false)
  const contentRef = useRef(null)
  const markerRef = useRef(null)
  const backToTop = t('doc.backToTop')
  const backToTopLabel =
    backToTop === 'doc.backToTop'
      ? lang === 'vi'
        ? 'Lên đầu trang'
        : 'Back to top'
      : backToTop

  useEffect(() => {
    if (!items.length) return undefined
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean)
    if (!headings.length) return undefined

    let frame = 0
    const mountUrl = `${window.location.pathname}${window.location.search}`
    // A new article (or new outline) owns the scroll position again.
    pinnedRef.current = false

    const measure = (writeHash) => {
      if (pinnedRef.current) return
      // A queued frame can outlive the article: the route (or its content) may
      // already be gone. Never let the previous article write its state onto
      // the next page's URL.
      if (`${window.location.pathname}${window.location.search}` !== mountUrl) {
        return
      }
      if (headings.some((heading) => !heading.isConnected)) return
      const scrolledToBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2
      let current = ''
      if (scrolledToBottom) {
        // Short final sections never reach the offset line; when the page is
        // bottomed out the last heading is the one being read.
        current = headings[headings.length - 1].id
      } else {
        for (const heading of headings) {
          if (heading.getBoundingClientRect().top <= OUTLINE_OFFSET) {
            current = heading.id
          } else {
            break
          }
        }
      }
      if (current === activeRef.current) return
      activeRef.current = current
      setActive(current)
      if (writeHash) syncOutlineHash(current)
    }

    const schedule = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure(true)
      })
    }

    const releasePin = () => {
      pinnedRef.current = false
    }

    // A deep link already names its section; keep it until scrolling starts.
    const initialId = readHashId()
    if (initialId && items.some((item) => item.id === initialId)) {
      activeRef.current = initialId
      setActive(initialId)
    } else {
      measure(false)
    }

    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('wheel', releasePin, { passive: true })
    window.addEventListener('touchmove', releasePin, { passive: true })
    window.addEventListener('pointerdown', releasePin)
    window.addEventListener('keydown', releasePin)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('wheel', releasePin)
      window.removeEventListener('touchmove', releasePin)
      window.removeEventListener('pointerdown', releasePin)
      window.removeEventListener('keydown', releasePin)
    }
  }, [items])

  // The marker is positioned against .content, while the links sit one title
  // line lower inside the outline list. Measure the active link instead of
  // assuming row heights so the bar stays centred on it.
  useLayoutEffect(() => {
    const marker = markerRef.current
    const content = contentRef.current
    if (!marker || !content) return undefined

    const position = () => {
      const link = content.querySelector('.outline-link.active')
      if (!link) {
        marker.style.top = ''
        marker.style.opacity = '0'
        return
      }
      const contentTop = content.getBoundingClientRect().top
      const linkRect = link.getBoundingClientRect()
      // The aside is display:none below the desktop breakpoint; wait for the
      // next resize instead of writing a bogus zero-height position.
      if (!linkRect.height || !marker.offsetHeight) return
      marker.style.top = `${
        linkRect.top - contentTop + (linkRect.height - marker.offsetHeight) / 2
      }px`
      marker.style.opacity = '1'
    }

    position()
    window.addEventListener('resize', position)
    return () => window.removeEventListener('resize', position)
  }, [active, items])

  if (!items.length) return null

  return (
    <nav
      aria-labelledby="doc-outline-aria-label"
      className="VPDocAsideOutline has-outline"
      data-v-03ead402=""
      data-v-7b6afc09=""
    >
      <div className="content" data-v-7b6afc09="" ref={contentRef}>
        <div className="outline-marker" data-v-7b6afc09="" ref={markerRef} />
        <div
          aria-level="2"
          className="outline-title"
          id="doc-outline-aria-label"
          role="heading"
          data-v-7b6afc09=""
        >
          {t('doc.onThisPage')}
        </div>
        <ul className="VPDocOutlineItem root" data-v-7b6afc09="" data-v-91e7bc45="">
          {items.map((item) => (
            <li key={item.id}>
              <a
                className={`outline-link${item.level === 3 ? ' nested' : ''}${
                  active === item.id ? ' active' : ''
                }`}
                data-v-91e7bc45=""
                href={`#${item.id}`}
                aria-current={active === item.id ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  pinnedRef.current = true
                  activeRef.current = item.id
                  setActive(item.id)
                  syncOutlineHash(item.id)
                  const target = document.getElementById(item.id)
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
              >
                {item.text}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="outline-link wd-outline-top"
          data-v-91e7bc45=""
          onClick={() => {
            pinnedRef.current = true
            activeRef.current = ''
            setActive('')
            syncOutlineHash('')
            const reduce = window.matchMedia?.(
              '(prefers-reduced-motion: reduce)',
            ).matches
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
          }}
        >
          <span className="wd-outline-top-icon" aria-hidden="true">
            ↑
          </span>
          {backToTopLabel}
        </button>
      </div>
    </nav>
  )
}

export default function DocsLayout({
  outline = [],
  asideTitle,
  asideLinks = [],
  activeCategory = '',
  footer = null,
  contentKey,
  contentPath,
  children,
}) {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Before paint: the marketing footer is dark and would flash for one frame
  // between a non-docs route and the docs shell if this ran after paint.
  useLayoutEffect(() => {
    document.documentElement.classList.add('docs-layout')
    return () => document.documentElement.classList.remove('docs-layout')
  }, [])
  const outlineKey = useMemo(
    () => outline.map((item) => item.id).join('|'),
    [outline],
  )

  return (
    <>
      <Sidebar
        activePath={pathname}
        activeCategory={activeCategory}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />
      {sidebarOpen && (
        <div
          className="wd-sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className="VPContent has-sidebar"
        id="VPContent"
        data-v-f5dfc737=""
        data-v-9749c0f9=""
      >
        <button
          type="button"
          className="wd-docs-menu-btn"
          aria-label={t('docs.openContents')}
          onClick={() => setSidebarOpen(true)}
        >
          <i className="fas fa-bars" /> {t('doc.onThisPage')}
        </button>
        <div className="VPDoc has-sidebar has-aside" data-v-9749c0f9="" data-v-27ccd7c0="">
          <div className="container" data-v-27ccd7c0="">
            <div className="aside" data-v-27ccd7c0="">
              <div className="aside-curtain" data-v-27ccd7c0="" />
              <div className="aside-container" data-v-27ccd7c0="">
                <div className="aside-content" data-v-27ccd7c0="">
                  <div className="VPDocAside" data-v-27ccd7c0="" data-v-03ead402="">
                    <AsideLinks
                      title={asideTitle || t('doc.onThisPage')}
                      links={asideLinks}
                    />
                    <Outline key={outlineKey} items={outline} />
                    <div className="spacer" data-v-03ead402="" />
                  </div>
                </div>
              </div>
            </div>
            <div className="content" data-v-27ccd7c0="">
              <div className="content-container" data-v-27ccd7c0="">
                <main className="main" data-v-27ccd7c0="">
                  <div
                    key={contentKey}
                    data-doc-path={contentPath || undefined}
                    className="vp-doc wd-doc-content"
                    data-v-27ccd7c0=""
                  >
                    {children}
                  </div>
                </main>
                {footer && (
                  <footer
                    className="VPDocFooter"
                    data-v-0b3bc9b9=""
                  >
                    {footer}
                  </footer>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
