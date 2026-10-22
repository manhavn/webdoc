export const defaultAppearance = {
  colors: {
    primary: '#0f766e',
    primaryDark: '#115e59',
    accent: '#0891b2',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    headerBackground: '#ffffff',
    headerText: '#0f172a',
    footerBackground: '#0b2b2a',
    footerText: '#d1fae5',
  },
  fonts: {
    body: 'Inter, ui-sans-serif, system-ui, sans-serif',
    heading: 'Inter, ui-sans-serif, system-ui, sans-serif',
    baseSize: '16px',
    googleFontsUrl: '',
  },
  background: {
    image: '',
    color: '#ffffff',
    overlay: 1,
    fixed: false,
  },
  header: {
    show: true,
    sticky: true,
    showSearch: true,
    showLanguage: true,
    background: '',
    text: '',
    ctaLabel: '',
    ctaLabelVi: '',
    ctaLabels: {},
    ctaUrl: '',
  },
  footer: {
    show: true,
    background: '',
    text: '',
    copyright: '',
    note: '',
    links: [],
    products: [],
  },
  theme: {
    default: 'system',
    options: ['system', 'light', 'dark'],
  },
  navigation: [],
  pages: [],
  cookie: {
    enabled: true,
    title: '',
    description: '',
    necessaryTitle: '',
    necessaryDescription: '',
    analyticsEnabled: true,
    analyticsDefault: true,
    analyticsTitle: '',
    analyticsDescription: '',
    marketingEnabled: true,
    marketingDefault: false,
    marketingTitle: '',
    marketingDescription: '',
    policyText: '',
    policyUrl: '',
    acceptAllText: '',
    onlyNecessaryText: '',
    saveText: '',
    closeText: '',
    footerText: '',
  },
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(source, key, fallback) {
  if (!isPlainObject(source)) return fallback
  const value = source[key]
  if (typeof value !== 'string') return fallback
  return value
}

function readBoolean(source, key, fallback) {
  if (!isPlainObject(source)) return fallback
  const value = source[key]
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return fallback
}

function readNumber(source, key, fallback, min, max) {
  if (!isPlainObject(source)) return fallback
  const value = Number(source[key])
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function mergeStringSection(defaults, remote) {
  const out = {}
  for (const key of Object.keys(defaults)) {
    out[key] = readString(remote, key, defaults[key])
  }
  return out
}

function readLabelMap(value) {
  if (!isPlainObject(value)) return {}
  const out = {}
  for (const [code, text] of Object.entries(value)) {
    if (typeof text === 'string') out[code] = text
  }
  return out
}

function withLegacy(labels, label, labelVi) {
  const out = { ...labels }
  if (!out.en && label) out.en = label
  if (!out.vi && labelVi) out.vi = labelVi
  return out
}

function normalizeLink(raw) {
  if (!isPlainObject(raw)) return null
  const label = readString(raw, 'label', '')
  const labelVi = readString(raw, 'labelVi', '')
  const href = readString(raw, 'href', '')
  if (!label && !labelVi && !href && Object.keys(readLabelMap(raw.labels)).length === 0) return null
  return {
    label,
    labelVi,
    labels: withLegacy(readLabelMap(raw.labels), label, labelVi),
    href,
  }
}

function normalizeNavLink(raw) {
  if (!isPlainObject(raw)) return null
  const label = readString(raw, 'label', '')
  const labelVi = readString(raw, 'labelVi', '')
  const href = readString(raw, 'href', '')
  const links = Array.isArray(raw.links)
    ? raw.links.map(normalizeNavLink).filter(Boolean)
    : []
  const labels = withLegacy(readLabelMap(raw.labels), label, labelVi)
  if (!label && !labelVi && Object.keys(labels).length === 0 && !href && links.length === 0) return null
  return { label, labelVi, labels, href, links }
}

function normalizePage(raw) {
  if (!isPlainObject(raw)) return null
  const slug = readString(raw, 'slug', '').trim().replace(/^\/+|\/+$/g, '')
  if (!slug) return null
  const title = readString(raw, 'title', '')
  const titleVi = readString(raw, 'titleVi', '')
  return {
    slug,
    title,
    titleVi,
    titles: withLegacy(readLabelMap(raw.titles), title, titleVi),
    content: readString(raw, 'content', ''),
  }
}

/* Merge the public appearance settings document with the defaults above.
   Objects (colors/fonts/background/header/footer) merge key by key, while
   arrays (navigation/pages/footer.links) are replaced wholesale - an empty
   array intentionally means "use the built-in menus" / "no pages". */
export function mergeAppearance(remote) {
  const source = isPlainObject(remote) ? remote : {}

  const backgroundDefaults = defaultAppearance.background
  const headerDefaults = defaultAppearance.header
  const footerDefaults = defaultAppearance.footer

  return {
    colors: mergeStringSection(defaultAppearance.colors, source.colors),
    fonts: mergeStringSection(defaultAppearance.fonts, source.fonts),
    background: {
      image: readString(source.background, 'image', backgroundDefaults.image),
      color: readString(source.background, 'color', backgroundDefaults.color),
      overlay: readNumber(
        source.background,
        'overlay',
        backgroundDefaults.overlay,
        0,
        1,
      ),
      fixed: readBoolean(source.background, 'fixed', backgroundDefaults.fixed),
    },
    header: {
      show: readBoolean(source.header, 'show', headerDefaults.show),
      sticky: readBoolean(source.header, 'sticky', headerDefaults.sticky),
      showSearch: readBoolean(
        source.header,
        'showSearch',
        headerDefaults.showSearch,
      ),
      showLanguage: readBoolean(
        source.header,
        'showLanguage',
        headerDefaults.showLanguage,
      ),
      background: readString(
        source.header,
        'background',
        headerDefaults.background,
      ),
      text: readString(source.header, 'text', headerDefaults.text),
      ctaLabel: readString(source.header, 'ctaLabel', headerDefaults.ctaLabel),
      ctaLabelVi: readString(
        source.header,
        'ctaLabelVi',
        headerDefaults.ctaLabelVi,
      ),
      ctaLabels: withLegacy(
        readLabelMap(source.header?.ctaLabels),
        readString(source.header, 'ctaLabel', headerDefaults.ctaLabel),
        readString(source.header, 'ctaLabelVi', headerDefaults.ctaLabelVi),
      ),
      ctaUrl: readString(source.header, 'ctaUrl', headerDefaults.ctaUrl),
    },
    theme: {
      default:
        source.theme && ['system', 'light', 'dark'].includes(source.theme.default)
          ? source.theme.default
          : defaultAppearance.theme.default,
      options: Array.isArray(source.theme?.options)
        ? source.theme.options.filter((value) =>
            ['system', 'light', 'dark'].includes(value),
          )
        : defaultAppearance.theme.options,
    },
    footer: {
      show: readBoolean(source.footer, 'show', footerDefaults.show),
      background: readString(
        source.footer,
        'background',
        footerDefaults.background,
      ),
      text: readString(source.footer, 'text', footerDefaults.text),
      copyright: readString(source.footer, 'copyright', footerDefaults.copyright),
      note: readString(source.footer, 'note', footerDefaults.note),
      links: Array.isArray(source.footer?.links)
        ? source.footer.links.map(normalizeLink).filter(Boolean)
        : [],
      products: Array.isArray(source.footer?.products)
        ? source.footer.products.map(normalizeLink).filter(Boolean)
        : [],
    },
    navigation: Array.isArray(source.navigation)
      ? source.navigation.map(normalizeNavLink).filter(Boolean)
      : [],
    pages: Array.isArray(source.pages)
      ? source.pages.map(normalizePage).filter(Boolean)
      : [],
    cookie: {
      enabled: readBoolean(source.cookie, 'enabled', defaultAppearance.cookie.enabled),
      title: readString(source.cookie, 'title', defaultAppearance.cookie.title),
      description: readString(source.cookie, 'description', defaultAppearance.cookie.description),
      necessaryTitle: readString(
        source.cookie,
        'necessaryTitle',
        defaultAppearance.cookie.necessaryTitle,
      ),
      necessaryDescription: readString(
        source.cookie,
        'necessaryDescription',
        defaultAppearance.cookie.necessaryDescription,
      ),
      analyticsEnabled: readBoolean(
        source.cookie,
        'analyticsEnabled',
        defaultAppearance.cookie.analyticsEnabled,
      ),
      analyticsDefault: readBoolean(
        source.cookie,
        'analyticsDefault',
        defaultAppearance.cookie.analyticsDefault,
      ),
      analyticsTitle: readString(
        source.cookie,
        'analyticsTitle',
        defaultAppearance.cookie.analyticsTitle,
      ),
      analyticsDescription: readString(
        source.cookie,
        'analyticsDescription',
        defaultAppearance.cookie.analyticsDescription,
      ),
      marketingEnabled: readBoolean(
        source.cookie,
        'marketingEnabled',
        defaultAppearance.cookie.marketingEnabled,
      ),
      marketingDefault: readBoolean(
        source.cookie,
        'marketingDefault',
        defaultAppearance.cookie.marketingDefault,
      ),
      marketingTitle: readString(
        source.cookie,
        'marketingTitle',
        defaultAppearance.cookie.marketingTitle,
      ),
      marketingDescription: readString(
        source.cookie,
        'marketingDescription',
        defaultAppearance.cookie.marketingDescription,
      ),
      policyText: readString(source.cookie, 'policyText', defaultAppearance.cookie.policyText),
      policyUrl: readString(source.cookie, 'policyUrl', defaultAppearance.cookie.policyUrl),
      acceptAllText: readString(
        source.cookie,
        'acceptAllText',
        defaultAppearance.cookie.acceptAllText,
      ),
      onlyNecessaryText: readString(
        source.cookie,
        'onlyNecessaryText',
        defaultAppearance.cookie.onlyNecessaryText,
      ),
      saveText: readString(source.cookie, 'saveText', defaultAppearance.cookie.saveText),
      closeText: readString(source.cookie, 'closeText', defaultAppearance.cookie.closeText),
      footerText: readString(source.cookie, 'footerText', defaultAppearance.cookie.footerText),
    },
  }
}

export function isVietnamese(lang) {
  return /^vi(?:[-_]|$)/i.test(String(lang || '').trim())
}

function labelFromMap(map, lang) {
  if (!map || typeof map !== 'object') return ''
  const code = String(lang || '').trim()
  const base = code.split('-')[0]
  return (
    (code && typeof map[code] === 'string' && map[code]) ||
    (base && typeof map[base] === 'string' && map[base]) ||
    (typeof map.en === 'string' && map.en) ||
    ''
  )
}

export function localizedLabel(item, lang) {
  if (!item) return ''
  const fromMap = labelFromMap(item.labels, lang)
  if (fromMap) return fromMap
  const preferred = isVietnamese(lang) ? item.labelVi : item.label
  const fallback = isVietnamese(lang) ? item.label : item.labelVi
  return preferred || fallback || ''
}


