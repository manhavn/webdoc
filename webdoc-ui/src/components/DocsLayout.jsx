import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useContent } from '../lib/ContentContext'
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

function docToSidebar(node, level = 0) {
  return {
    text: node.title,
    link: node.path,
    order: node.order,
    items: (node.children || []).map((child) => docToSidebar(child, level + 1)),
  }
}

function Sidebar({ activePath, activeCategory, open, onNavigate }) {
  const { docsTree } = useContent()
  const { t } = useI18n()
  const groups = useMemo(
    () =>
      [...docsTree]
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map((node) => docToSidebar(node)),
    [docsTree],
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

function Outline({ items }) {
  const { t, lang } = useI18n()
  const [active, setActive] = useState('')
  const suppressUntil = useRef(0)
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === active),
  )
  const backToTop = t('doc.backToTop')
  const backToTopLabel =
    backToTop === 'doc.backToTop'
      ? lang === 'vi'
        ? 'Lên đầu trang'
        : 'Back to top'
      : backToTop

  useEffect(() => {
    if (!items.length) return
    const headings = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean)
    if (!headings.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressUntil.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: [0, 1] },
    )
    headings.forEach((heading) => observer.observe(heading))
    return () => observer.disconnect()
  }, [items])

  if (!items.length) return null

  return (
    <nav
      aria-labelledby="doc-outline-aria-label"
      className="VPDocAsideOutline has-outline"
      data-v-03ead402=""
      data-v-7b6afc09=""
    >
      <div className="content" data-v-7b6afc09="">
        <div
          className="outline-marker"
          data-v-7b6afc09=""
          style={{ top: 32 + activeIndex * 32, opacity: active ? 1 : 0 }}
        />
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
                onClick={(event) => {
                  event.preventDefault()
                  suppressUntil.current = Date.now() + 900
                  setActive(item.id)
                  const target = document.getElementById(item.id)
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                  window.history.replaceState(null, '', `#${item.id}`)
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
            suppressUntil.current = Date.now() + 900
            setActive('')
            const reduce = window.matchMedia?.(
              '(prefers-reduced-motion: reduce)',
            ).matches
            window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
            window.history.replaceState(
              null,
              '',
              window.location.pathname + window.location.search,
            )
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
  animateContent = false,
  children,
}) {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
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
                    className={`vp-doc wd-doc-content${
                      animateContent ? ' wd-doc-enter' : ''
                    }`}
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
