import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SearchModal from './SearchModal'
import LanguageSwitch from './LanguageSwitch'
import ThemeSwitch from './ThemeSwitch'
import { useContent } from '../lib/ContentContext'
import { useTheme } from '../theme/ThemeContext'
import { useI18n } from '../i18n/I18nContext'
import { localizedLabel } from '../data/appearance'

/* The admin app is a separate SPA mounted under /admin. A public-site Link
   would route it through the docs catch-all, so admin URLs need a real page
   load while staying in the same tab. */
function isAdminHref(href) {
  return /^\/admin(?:\/|$|[?#])/.test(href)
}

function isInternal(href) {
  return href.startsWith('/') && !href.startsWith('//') && !isAdminHref(href)
}

function MenuLink({ href, children, className = 'VPLink link', ...rest }) {
  if (!href) return null
  if (isInternal(href)) {
    return (
      <Link className={className} to={href} {...rest}>
        {children}
      </Link>
    )
  }
  const hardLink = href.startsWith('/') && !href.startsWith('//')
  return (
    <a
      className={className}
      href={href}
      target={hardLink ? undefined : '_blank'}
      rel={hardLink ? undefined : 'noreferrer'}
      {...rest}
    >
      {children}
    </a>
  )
}

function isExternalHref(href) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(href)
}

/* Child links are configured relative to their parent (for example
   /tai-khoan under /huong-dan-su-dung). Keep external URLs and anchors as-is. */
function childHref(parentHref, rawHref) {
  const href = String(rawHref || '').trim()
  if (!href || isExternalHref(href)) return href
  if (!parentHref.startsWith('/')) return href
  const base = parentHref.replace(/\/+$/, '')
  if (!base) return href.startsWith('/') ? href : `/${href}`
  if (href === base || href.startsWith(`${base}/`)) return href
  return `${base}/${href.replace(/^\/+/, '')}`
}

function buildMenuLinks(items, parentHref, keyPrefix, lang) {
  return (items || [])
    .map((link, index) => {
      const href = childHref(parentHref, link.href)
      const label = localizedLabel(link, lang) || href
      const links = buildMenuLinks(link.links, href, `${keyPrefix}-${index}`, lang)
      return { key: `${keyPrefix}-${index}`, label, href, links }
    })
    .filter((link) => link.label && (link.href || link.links.length))
}

function customMenus(navigation, lang) {
  return navigation
    .map((item, index) => {
      const href = String(item.href || '').trim()
      const label = localizedLabel(item, lang) || href
      const links = buildMenuLinks(item.links, href, `custom-${index}`, lang)
      return {
        key: `custom-${index}-${href || links.length}`,
        label,
        href,
        links,
      }
    })
    .filter((menu) => menu.label && (menu.href || menu.links.length))
}

function DesktopMenuLinks({ links, openSubmenus, onOpenSubmenu, onToggleSubmenu }) {
  return links.map((link) => {
    if (link.links.length === 0) {
      return (
        <div className="VPMenuLink" data-v-8a9c8d2a="" data-v-abe4527c="" key={link.key}>
          <MenuLink href={link.href} data-v-abe4527c="">
            <span data-v-abe4527c="">{link.label}</span>
          </MenuLink>
        </div>
      )
    }

    const open = openSubmenus.has(link.key)
    const itemsId = `wd-nav-subtree-${link.key}`
    return (
      <div
        className={`wd-nav-subtree${open ? ' open' : ''}`}
        key={link.key}
        onMouseEnter={() => onOpenSubmenu(link.key)}
      >
        <div className="wd-nav-subtree-head">
          {link.href ? (
            <MenuLink
              href={link.href}
              className="VPLink link wd-nav-subtree-link"
              data-v-abe4527c=""
              onFocus={() => onOpenSubmenu(link.key)}
            >
              <span>{link.label}</span>
            </MenuLink>
          ) : (
            <button
              type="button"
              className="VPLink link wd-nav-subtree-link"
              data-v-abe4527c=""
              onFocus={() => onOpenSubmenu(link.key)}
              onClick={() => onToggleSubmenu(link.key)}
            >
              <span>{link.label}</span>
            </button>
          )}
          <button
            type="button"
            className="wd-nav-subtree-toggle"
            aria-expanded={open}
            aria-controls={itemsId}
            aria-label={link.label}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onToggleSubmenu(link.key)
            }}
          >
            <span className="wd-nav-subtree-caret" aria-hidden="true" />
          </button>
        </div>
        <div className="wd-nav-subtree-items" id={itemsId}>
          <div className="wd-nav-subtree-items-inner">
            <DesktopMenuLinks
              links={link.links}
              openSubmenus={openSubmenus}
              onOpenSubmenu={onOpenSubmenu}
              onToggleSubmenu={onToggleSubmenu}
            />
          </div>
        </div>
      </div>
    )
  })
}

function MobileMenuLinks({ links, expanded, onToggle }) {
  return links.map((link) =>
    link.links.length > 0 ? (
      <div className="wd-nav-mobile-group" key={link.key}>
        <div className="wd-nav-mobile-row">
          {link.href ? (
            <MenuLink
              href={link.href}
              className="wd-nav-mobile-link"
              data-v-ba9cadcd=""
            >
              {link.label}
            </MenuLink>
          ) : (
            <span className="wd-nav-mobile-link">{link.label}</span>
          )}
          <button
            type="button"
            className="wd-nav-mobile-toggle"
            aria-expanded={Boolean(expanded[link.key])}
            aria-label={link.label}
            onClick={() => onToggle(link.key)}
          >
            <span className="wd-nav-mobile-caret" />
          </button>
        </div>
        {expanded[link.key] && (
          <div className="wd-nav-mobile-items">
            <MobileMenuLinks
              links={link.links}
              expanded={expanded}
              onToggle={onToggle}
            />
          </div>
        )}
      </div>
    ) : (
      <div className="VPNavScreenMenuGroupLink" data-v-ba9cadcd="" key={link.key}>
        <MenuLink href={link.href} data-v-ba9cadcd="">
          {link.label}
        </MenuLink>
      </div>
    ),
  )
}

export default function NavBar() {
  const [openMenu, setOpenMenu] = useState(null)
  const openMenuRef = useRef(openMenu)
  const [openSubmenus, setOpenSubmenus] = useState(() => new Set())
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileGroup, setMobileGroup] = useState(null)
  const [mobileSub, setMobileSub] = useState({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [hoverGuard, setHoverGuard] = useState(false)
  const location = useLocation()
  const closeTimer = useRef(null)
  const hoveredMenu = useRef(null)
  const openedByHover = useRef(null)
  const suppressFocusOpen = useRef(false)
  const { site, appearance } = useContent()
  const { t, lang } = useI18n()
  const { resolved } = useTheme()
  const fallbackLogo =
    resolved === 'dark'
      ? '/assets/images/webdoc-logo-dark.svg'
      : '/assets/images/webdoc-logo.svg'

  const header = appearance.header
  const showHeader = header.show !== false
  const sticky = header.sticky !== false
  const showSearch = header.showSearch !== false
  const showLanguage = header.showLanguage !== false
  const ctaLabel = String(
    localizedLabel(
      {
        labels: header.ctaLabels,
        label: header.ctaLabel,
        labelVi: header.ctaLabelVi,
      },
      lang,
    ) || '',
  ).trim()
  const ctaUrl = String(header.ctaUrl || '').trim()

  // Navigation is data-only. An empty/missing navigation array means the
  // site has no menu yet; no built-in demo menu is injected.
  const menus = useMemo(
    () => customMenus(appearance.navigation, lang),
    [appearance.navigation, lang],
  )

  useEffect(() => {
    setMobileOpen(false)
    // Close the flyout on navigation, but when it closes out from under the
    // pointer, shield the page until the next interaction: otherwise the
    // browser immediately re-targets hover to whatever the new page paints at
    // that spot (the pointer appears to "jump" from the clicked item).
    if (hoveredMenu.current !== null) setHoverGuard(true)
    hoveredMenu.current = null
    openedByHover.current = null
    setOpenMenu(null)
  }, [location.pathname, location.hash])

  useEffect(() => {
    openMenuRef.current = openMenu
    if (openMenu === null) openedByHover.current = null
  }, [openMenu])

  // A menu opened by hover or focus must be dismissible without moving the
  // pointer (WCAG 1.4.13). Return focus to the trigger so keyboard users do
  // not stay on a link that just went out of view.
  useEffect(() => {
    if (openMenu === null) return undefined
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      const active = document.activeElement
      const group = active?.closest?.('.VPNavBarMenuGroup')
      const trigger = group?.querySelector(':scope > .button')
      if (group && trigger && active !== trigger) {
        suppressFocusOpen.current = true
        trigger.focus()
      }
      hoveredMenu.current = null
      openedByHover.current = null
      clearTimeout(closeTimer.current)
      setOpenMenu(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openMenu])

  useEffect(() => {
    if (!hoverGuard) return undefined
    const release = () => setHoverGuard(false)
    window.addEventListener('pointermove', release, true)
    window.addEventListener('wheel', release, true)
    window.addEventListener('keydown', release, true)
    return () => {
      window.removeEventListener('pointermove', release, true)
      window.removeEventListener('wheel', release, true)
      window.removeEventListener('keydown', release, true)
    }
  }, [hoverGuard])

  // Nested submenus stay open while the pointer moves inside the same
  // top-level dropdown. Closing them on every hover-out collapsed the panel
  // under the cursor and made long menus impossible to navigate.
  useEffect(() => {
    setOpenSubmenus((current) => (current.size ? new Set() : current))
  }, [openMenu])

  useEffect(() => {
    if (!mobileOpen) {
      setMobileGroup(null)
      setMobileSub({})
    }
  }, [mobileOpen])

  const toggleMobileSub = useCallback((key) => {
    setMobileSub((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    if (!showHeader) {
      setMobileOpen(false)
      setOpenMenu(null)
    }
  }, [showHeader])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('wd-nav-hidden', !showHeader)
    root.classList.toggle('wd-nav-static', !showHeader || !sticky)
    return () => {
      root.classList.remove('wd-nav-hidden')
      root.classList.remove('wd-nav-static')
    }
  }, [showHeader, sticky])

  useEffect(() => {
    if (!showHeader || !showSearch) {
      setSearchOpen(false)
      return undefined
    }
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showHeader, showSearch])

  const openSubmenu = useCallback((key) => {
    setOpenSubmenus((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }, [])

  const toggleSubmenu = useCallback((key) => {
    setOpenSubmenus((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const hoverProps = useCallback(
    (index) => ({
      onMouseEnter: () => {
        clearTimeout(closeTimer.current)
        // Only a menu opened by this hover should swallow the click that
        // follows it; a click on an already-open panel still toggles it shut.
        if (openMenuRef.current !== index) openedByHover.current = index
        hoveredMenu.current = index
        setOpenMenu(index)
      },
      onMouseLeave: () => {
        hoveredMenu.current = null
        openedByHover.current = null
        closeTimer.current = setTimeout(() => setOpenMenu(null), 120)
      },
      onFocus: () => {
        if (suppressFocusOpen.current) {
          suppressFocusOpen.current = false
          return
        }
        clearTimeout(closeTimer.current)
        setOpenMenu(index)
      },
      onBlur: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpenMenu(null)
      },
    }),
    [],
  )

  if (!showHeader) return null

  return (
    <>
      <header
        className={`VPNav${sticky ? '' : ' wd-nav-static'}`}
        data-v-f5dfc737=""
        data-v-869036de=""
      >
        <div className="VPNavBar" data-v-869036de="" data-v-99773bcd="">
          <div className="wrapper" data-v-99773bcd="">
            <div className="container" data-v-99773bcd="">
              <div className="title" data-v-99773bcd="">
                <div className="VPNavBarTitle" data-v-99773bcd="" data-v-8f6fe741="">
                  <Link
                    className="title"
                    data-v-8f6fe741=""
                    to="/"
                    aria-label={t('nav.logoLabel')}
                  >
                    <img
                      src={site.headerLogo || fallbackLogo}
                      className="logo" data-v-8f6fe741=""
                      alt={site.siteName || 'WebDoc'}
                    />
                  </Link>
                </div>
              </div>
              <div className="content" data-v-99773bcd="">
                <div className="content-body" data-v-99773bcd="">
                  {showSearch && (
                    <div className="VPNavBarSearch search" data-v-99773bcd="">
                      <div id="local-search">
                        <button
                          type="button"
                          className="DocSearch DocSearch-Button"
                          aria-label={t('nav.search')}
                          onClick={() => setSearchOpen(true)}
                        >
                          <span className="DocSearch-Button-Container">
                            <span className="vp-icon DocSearch-Search-Icon" />
                            <span className="DocSearch-Button-Placeholder">
                              {t('nav.search')}
                            </span>
                          </span>
                          <span className="DocSearch-Button-Keys">
                            <kbd className="DocSearch-Button-Key">⌘</kbd>
                            <kbd className="DocSearch-Button-Key">K</kbd>
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                  <nav
                    aria-labelledby="main-nav-aria-label"
                    className="VPNavBarMenu menu" data-v-99773bcd="" data-v-b70e7c48=""
                  >
                    <span id="main-nav-aria-label" className="visually-hidden">
                      {t('nav.mainNavigation')}
                    </span>
                    {menus.map((menu, idx) =>
                      menu.links.length > 0 ? (
                        <div
                          key={menu.key}
                          data-v-b70e7c48="" data-v-09aac909=""
                          className={`VPFlyout VPNavBarMenuGroup${
                            openMenu === idx ? ' open' : ''
                          }`}
                          {...hoverProps(idx)}
                        >
                          {menu.href ? (
                            <MenuLink
                              href={menu.href}
                              data-v-09aac909=""
                              className="button VPNavBarMenuGroupLink"
                              aria-haspopup="true"
                              aria-expanded={openMenu === idx}
                            >
                              <span className="text" data-v-09aac909="">
                                <span data-v-09aac909="">{menu.label}</span>
                                <span className="vpi-chevron-down text-icon" data-v-09aac909="" />
                              </span>
                            </MenuLink>
                          ) : (
                            <button
                              type="button"
                              data-v-09aac909=""
                              className="button"
                              aria-haspopup="true"
                              aria-expanded={openMenu === idx}
                              onClick={() => {
                                if (openedByHover.current === idx) {
                                  openedByHover.current = null
                                  return
                                }
                                setOpenMenu(openMenu === idx ? null : idx)
                              }}
                            >
                              <span className="text" data-v-09aac909="">
                                <span data-v-09aac909="">{menu.label}</span>
                                <span className="vpi-chevron-down text-icon" data-v-09aac909="" />
                              </span>
                            </button>
                          )}
                          <div className="menu" data-v-09aac909="">
                            <div className="VPMenu" data-v-09aac909="" data-v-8a9c8d2a="">
                              <div className="items" data-v-8a9c8d2a="">
                                <DesktopMenuLinks
                                  links={menu.links}
                                  openSubmenus={openSubmenus}
                                  onOpenSubmenu={openSubmenu}
                                  onToggleSubmenu={toggleSubmenu}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <MenuLink
                          key={menu.key}
                          href={menu.href}
                          className="VPLink link VPNavBarMenuLink"
                          data-v-b70e7c48=""
                          data-v-1ca0b62c=""
                        >
                          <span data-v-1ca0b62c="">{menu.label}</span>
                        </MenuLink>
                      ),
                    )}
                    {ctaLabel && ctaUrl && (
                      <MenuLink
                        href={ctaUrl}
                        className="wd-nav-cta"
                        data-v-b70e7c48=""
                      >
                        {ctaLabel}
                      </MenuLink>
                    )}
                  </nav>
                  <ThemeSwitch className="wd-theme-switch--desktop" />
                  {showLanguage && (
                    <LanguageSwitch className="wd-lang-switch--desktop" />
                  )}
                  <button
                    type="button"
                    data-v-99773bcd=""
                    data-v-5f3affc8=""
                    className={`VPNavBarHamburger hamburger${
                      mobileOpen ? ' active' : ''
                    }`}
                    aria-label={t('nav.mobileNavigation')}
                    aria-expanded={mobileOpen}
                    aria-controls="VPNavScreen"
                    onClick={() => setMobileOpen((v) => !v)}
                  >
                    <span className="container" data-v-5f3affc8="">
                      <span className="top" data-v-5f3affc8="" />
                      <span className="middle" data-v-5f3affc8="" />
                      <span className="bottom" data-v-5f3affc8="" />
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="divider" data-v-99773bcd="">
            <div className="divider-line" data-v-99773bcd="" />
          </div>
        </div>
      </header>

      {mobileOpen && (
        <nav className="VPNavScreen" id="VPNavScreen" data-v-3ab4695a="">
          <div className="container" data-v-3ab4695a="">
            <div className="VPNavScreenMenu">
              {menus.map((menu, idx) =>
                menu.links.length > 0 ? (
                  <div
                    key={menu.key}
                    data-v-904235c3=""
                    className={`VPNavScreenMenuGroup${
                      mobileGroup === idx ? ' open' : ''
                    }`}
                  >
                    {menu.href ? (
                      <div className="VPNavScreenMenuGroupHead">
                        <MenuLink
                          href={menu.href}
                          data-v-904235c3=""
                          className="button"
                        >
                          <span className="text" data-v-904235c3="">{menu.label}</span>
                        </MenuLink>
                        <button
                          type="button"
                          className="VPNavScreenMenuGroupToggle"
                          aria-expanded={mobileGroup === idx}
                          aria-label={menu.label}
                          onClick={() =>
                            setMobileGroup(mobileGroup === idx ? null : idx)
                          }
                        >
                          <span className="vpi-chevron-down" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-v-904235c3=""
                        className="button"
                        onClick={() =>
                          setMobileGroup(mobileGroup === idx ? null : idx)
                        }
                      >
                        <span className="text" data-v-904235c3="">{menu.label}</span>
                        <span className="vpi-chevron-down text-icon" data-v-904235c3="" />
                      </button>
                    )}
                    {mobileGroup === idx && (
                      <div className="items" data-v-904235c3="">
                        <MobileMenuLinks
                          links={menu.links}
                          expanded={mobileSub}
                          onToggle={toggleMobileSub}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="VPNavScreenMenuLink"
                    data-v-608a9fe7=""
                    key={menu.key}
                  >
                    <MenuLink href={menu.href} data-v-608a9fe7="">
                      {menu.label}
                    </MenuLink>
                  </div>
                ),
              )}
              {ctaLabel && ctaUrl && (
                <div className="VPNavScreenMenuLink wd-nav-cta-row" data-v-608a9fe7="">
                  <MenuLink href={ctaUrl} className="wd-nav-cta wd-nav-cta--mobile">
                    {ctaLabel}
                  </MenuLink>
                </div>
              )}
              <ThemeSwitch className="wd-theme-switch--mobile" />
              {showLanguage && (
                <LanguageSwitch className="wd-lang-switch--mobile" />
              )}
            </div>
          </div>
        </nav>
      )}

      {/* Invisible for one interaction after a flyout link navigation: keeps
          the pointer from instantly hovering/clicking the page that slides
          under it. Removed on the first move, wheel or key press. */}
      {hoverGuard && (
        <div
          className="wd-nav-hover-guard"
          aria-hidden="true"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setHoverGuard(false)
          }}
        />
      )}

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
