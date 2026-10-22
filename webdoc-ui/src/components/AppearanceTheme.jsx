import { useEffect } from 'react'
import { useContent } from '../lib/ContentContext'
import { defaultAppearance } from '../data/appearance'
import { useTheme } from '../theme/ThemeContext'

const STYLE_ID = 'wd-appearance'
const FONT_LINK_ID = 'wd-appearance-fonts'
const GOOGLE_FONTS_PREFIX = 'https://fonts.googleapis.com/'

const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const COLOR_RE =
  /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)|[a-z]{3,20})$/i
const SIZE_RE = /^\d{1,3}(?:\.\d+)?(?:px|rem|em|%)$/

function safeColor(value, fallback) {
  const raw = String(value == null ? '' : value).trim()
  if (raw && raw.length <= 64 && COLOR_RE.test(raw)) return raw
  return fallback
}

function safeFont(value, fallback) {
  const raw = String(value == null ? '' : value)
    .replace(/[;{}<>]/g, '')
    .trim()
  return raw || fallback
}

function safeSize(value, fallback) {
  const raw = String(value == null ? '' : value).trim()
  return SIZE_RE.test(raw) ? raw : fallback
}

function safeImageUrl(value) {
  const raw = String(value == null ? '' : value).trim()
  if (!raw) return ''
  if (/^(?:javascript|vbscript|data:text\/html)/i.test(raw)) return ''
  return raw.replace(/["'()\\\n\r\t]/g, (char) => encodeURIComponent(char))
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return max
  return Math.min(max, Math.max(min, number))
}

function hexToRgb(hex) {
  const raw = String(hex || '').trim()
  if (!HEX_RE.test(raw)) return null
  let value = raw.slice(1)
  if (value.length === 3 || value.length === 4) {
    value = value
      .slice(0, 3)
      .split('')
      .map((char) => char + char)
      .join('')
  }
  if (value.length !== 6 && value.length !== 8) return null
  const number = parseInt(value.slice(0, 6), 16)
  if (!Number.isFinite(number)) return null
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  }
}

function rgba(color, alpha) {
  const rgb = hexToRgb(color)
  if (!rgb) return `rgba(0, 0, 0, ${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function readableOn(color) {
  const rgb = hexToRgb(color)
  if (!rgb) return '#ffffff'
  // Perceived luminance (YIQ) is enough to keep button labels readable.
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return yiq >= 160 ? '#0f172a' : '#ffffff'
}

export function buildAppearanceCss(appearance = defaultAppearance, theme = 'light') {
  const colors = { ...defaultAppearance.colors, ...(appearance.colors || {}) }
  const fonts = { ...defaultAppearance.fonts, ...(appearance.fonts || {}) }
  const background = {
    ...defaultAppearance.background,
    ...(appearance.background || {}),
  }
  const header = { ...defaultAppearance.header, ...(appearance.header || {}) }
  const footer = { ...defaultAppearance.footer, ...(appearance.footer || {}) }

  const primary = safeColor(colors.primary, defaultAppearance.colors.primary)
  const primaryDark = safeColor(
    colors.primaryDark,
    defaultAppearance.colors.primaryDark,
  )
  const accent = safeColor(colors.accent, defaultAppearance.colors.accent)
  const dark = theme === 'dark'
  const text = dark ? '#e5e7eb' : safeColor(colors.text, defaultAppearance.colors.text)
  const muted = dark ? '#94a3b8' : safeColor(colors.muted, defaultAppearance.colors.muted)
  const border = dark ? '#334155' : safeColor(colors.border, defaultAppearance.colors.border)
  const surface = dark ? '#111827' : safeColor(colors.surface, defaultAppearance.colors.surface)
  const pageBackground = dark
    ? '#0b1220'
    : safeColor(
        background.color || colors.background,
        defaultAppearance.colors.background,
      )
  const headerBackground = dark
    ? '#0f172a'
    : safeColor(
        header.background || colors.headerBackground,
        defaultAppearance.colors.headerBackground,
      )
  const headerText = dark
    ? '#f8fafc'
    : safeColor(
        header.text || colors.headerText,
        defaultAppearance.colors.headerText,
      )
  const footerBackground = dark
    ? '#020617'
    : safeColor(
        footer.background || colors.footerBackground,
        defaultAppearance.colors.footerBackground,
      )
  const footerText = dark
    ? '#cbd5e1'
    : safeColor(
        footer.text || colors.footerText,
        defaultAppearance.colors.footerText,
      )
  const bodyFont = safeFont(fonts.body, defaultAppearance.fonts.body)
  const headingFont = safeFont(
    fonts.heading || fonts.body,
    defaultAppearance.fonts.heading,
  )
  const baseSize = safeSize(fonts.baseSize, defaultAppearance.fonts.baseSize)
  const onPrimary = readableOn(primary)
  const imageUrl = safeImageUrl(background.image)
  const overlayAlpha = clamp(background.overlay, 0, 1)
  const overlayColor = rgba(pageBackground, overlayAlpha)
  const fixed = background.fixed === true
  const brandSoft = rgba(primary, 0.12)

  const bodyBackground = imageUrl
    ? `
body {
  background-image: linear-gradient(${overlayColor}, ${overlayColor}), url("${imageUrl}") !important;
  background-size: cover !important;
  background-position: center center !important;
  background-repeat: no-repeat !important;
  background-attachment: ${fixed ? 'fixed' : 'scroll'} !important;
}`
    : `
body {
  background-image: none !important;
}`

  return `
:root {
  --vp-c-brand: ${primary};
  --vp-c-brand-1: ${primary};
  --vp-c-brand-2: ${primaryDark};
  --vp-c-brand-3: ${primary};
  --vp-c-brand-soft: ${brandSoft};
  --vp-c-bg: ${pageBackground};
  --vp-c-bg-alt: ${surface};
  --vp-c-bg-soft: ${surface};
  --vp-c-bg-elv: ${surface};
  --vp-c-text-1: ${text};
  --vp-c-text-2: ${muted};
  --vp-c-text-3: ${muted};
  --vp-c-divider: ${border};
  --vp-c-border: ${border};
  --vp-c-gutter: ${border};
  --vp-nav-bg-color: ${headerBackground};
  --vp-nav-screen-bg-color: ${headerBackground};
  --vp-sidebar-bg-color: ${surface};
  --vp-font-family-base: ${bodyFont};
  --vp-button-brand-bg: ${primary};
  --vp-button-brand-hover-bg: ${primaryDark};
  --vp-button-brand-active-bg: ${primaryDark};
  --vp-button-brand-border: ${primary};
  --vp-button-brand-hover-border: ${primaryDark};
  --vp-button-brand-text: ${onPrimary};
  --vp-button-brand-hover-text: ${onPrimary};
  --vp-button-brand-active-text: ${onPrimary};
  --wd-accent: ${accent};
  --wd-on-primary: ${onPrimary};
  --wd-header-bg: ${headerBackground};
  --wd-header-text: ${headerText};
  --wd-footer-bg: ${footerBackground};
  --wd-footer-text: ${footerText};
}

html {
  font-size: ${baseSize} !important;
  background-color: ${pageBackground} !important;
}

body {
  font-family: ${bodyFont} !important;
  font-size: ${baseSize} !important;
  color: ${text} !important;
  background-color: ${pageBackground} !important;
}
${bodyBackground}

h1, h2, h3, h4, h5, h6,
.section-header,
.VPNavBarTitle .title,
.wd-contact-hero h1 {
  font-family: ${headingFont} !important;
}

/* Header surfaces (light/dark) — override the hardcoded theme backgrounds. */
.VPNav,
.VPNavBar,
.VPNavBar .content-body,
.VPNavBar.screen-open,
.VPNavScreen,
.VPNavBar .wrapper {
  background-color: ${headerBackground} !important;
}

.VPNavBar .VPNavBarMenuLink,
.VPNavBar .VPFlyout .button,
.VPNavBar .VPFlyout .button .text,
.VPNavBar .VPNavBarTitle .title,
.VPNavBar .DocSearch-Button,
.VPNavBar .DocSearch-Button-Placeholder,
.VPNavBar .DocSearch-Button .vp-icon,
.VPNavBar .VPNavBarHamburger span,
.VPNavBar .wd-lang-switch__btn,
.VPNavScreenMenuLink > a,
.VPNavScreenMenuGroup .button .text,
.VPNavScreen .wd-lang-switch__btn {
  color: ${headerText} !important;
}

.VPNavBar .VPNavBarMenuLink:hover,
.VPNavBar .VPFlyout .button:hover,
.VPNavBar .VPNavBarTitle .title:hover,
.VPNavScreenMenuLink > a:hover,
.VPNavScreenMenuGroup .button:hover .text {
  color: ${headerText} !important;
  opacity: 0.78;
}

.VPNavBar .VPNavBarHamburger .top,
.VPNavBar .VPNavBarHamburger .middle,
.VPNavBar .VPNavBarHamburger .bottom {
  background-color: ${headerText} !important;
}

.VPNavBar .divider-line,
.VPNavBar.screen-open {
  background-color: ${border} !important;
}

.VPNavBar .wd-lang-switch {
  background-color: transparent !important;
  border-color: ${rgba(headerText, 0.35)} !important;
}

.wd-nav-cta {
  background-color: ${primary} !important;
  border-color: ${primary} !important;
  color: ${onPrimary} !important;
}

.wd-nav-cta:hover {
  background-color: ${primaryDark} !important;
  border-color: ${primaryDark} !important;
  color: ${onPrimary} !important;
  opacity: 1;
}

/* Footer surfaces */
.VPFooter,
.site-footer {
  background-color: ${footerBackground} !important;
  color: ${footerText} !important;
  border-color: ${border} !important;
}

.site-footer__brand strong,
.site-footer__title,
.site-footer__col a,
.site-footer__col li a i,
.site-footer__about a,
.site-footer__bottom {
  color: ${footerText} !important;
}

.site-footer__brand span,
.site-footer__about p {
  color: ${footerText} !important;
  opacity: 0.78;
}

.site-footer__col a:hover,
.site-footer__about a:hover,
.site-footer__bottom button:hover {
  color: ${footerText} !important;
  opacity: 0.7;
}

/* Primary actions, links and marketing accents. */
.wd-btn--solid,
.wd-pagination button.is-active,
.wd-card-tag {
  background-color: ${primary} !important;
  border-color: ${primary} !important;
  color: ${onPrimary} !important;
}

.wd-btn--solid:hover {
  background-color: ${primaryDark} !important;
  border-color: ${primaryDark} !important;
  color: ${onPrimary} !important;
}

.wd-btn:not(.wd-btn--solid):hover {
  border-color: ${primary} !important;
  color: ${primary} !important;
}

.wd-link,
.wd-readmore,
.wd-eyebrow,
.wd-breadcrumb a:hover,
.wd-contact-card a:hover {
  color: ${primary} !important;
}

.wd-contact-form input:focus,
.wd-contact-form textarea:focus {
  border-color: ${primary} !important;
  box-shadow: 0 0 0 3px ${brandSoft} !important;
}

.wd-contact-card > i {
  background-color: ${brandSoft} !important;
  color: ${primary} !important;
}

.wd-tags span {
  background-color: ${rgba(primary, 0.08)} !important;
  border-color: ${rgba(primary, 0.35)} !important;
  color: ${primary} !important;
}

.wd-contact-hero {
  background: linear-gradient(120deg, ${primaryDark}, ${primary} 55%, ${accent}) !important;
}

.wd-contact-hero .wd-eyebrow {
  color: ${rgba('#ffffff', 0.85)} !important;
}

.wd-contact-hero .wd-lead {
  color: ${rgba('#ffffff', 0.9)} !important;
}

/* Tailwind palette utilities remapped by the marketing sections. */
.bg-fuchsia-700,
.bg-fuchsia-900 {
  background-color: ${primary} !important;
  color: ${onPrimary} !important;
}

.bg-fuchsia-500 {
  background-color: ${accent} !important;
}

.bg-indigo-200 {
  background-color: ${rgba(accent, 0.35)} !important;
}

.bg-purple-200 {
  background-color: ${rgba(primary, 0.25)} !important;
}

.text-fuchsia-400 {
  color: ${accent} !important;
}

.text-fuchsia-600,
.text-fuchsia-700 {
  color: ${primary} !important;
}

.text-fuchsia-800 {
  color: ${primaryDark} !important;
}

.from-fuchsia-500 {
  --tw-gradient-from: ${accent} !important;
}

.from-fuchsia-950 {
  --tw-gradient-from: ${primaryDark} !important;
}

.to-fuchsia-800,
.to-fuchsia-900 {
  --tw-gradient-to: ${primaryDark} !important;
}

.VPDocAsideOutline .outline-link.active {
  color: ${primary} !important;
}
`
}

function applyGoogleFonts(url) {
  const href = String(url == null ? '' : url).trim()
  const existing = document.getElementById(FONT_LINK_ID)
  if (!href.startsWith(GOOGLE_FONTS_PREFIX)) {
    if (existing) existing.remove()
    return
  }
  if (existing) {
    if (existing.getAttribute('href') !== href) existing.setAttribute('href', href)
    return
  }
  const link = document.createElement('link')
  link.id = FONT_LINK_ID
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

export default function AppearanceTheme() {
  const { appearance } = useContent()
  const { resolved } = useTheme()

  useEffect(() => {
    if (typeof document === 'undefined') return
    let style = document.getElementById(STYLE_ID)
    if (!style) {
      style = document.createElement('style')
      style.id = STYLE_ID
      document.head.appendChild(style)
    }
    style.textContent = buildAppearanceCss(appearance, resolved)
    applyGoogleFonts(appearance.fonts && appearance.fonts.googleFontsUrl)
  }, [appearance, resolved])

  return null
}
