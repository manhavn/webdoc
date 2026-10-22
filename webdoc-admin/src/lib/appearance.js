export const DEFAULT_APPEARANCE = {
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
};

export const COLOR_KEYS = Object.freeze(Object.keys(DEFAULT_APPEARANCE.colors));
export const FONT_KEYS = Object.freeze(Object.keys(DEFAULT_APPEARANCE.fonts));

export const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function isHexColor(value) {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim());
}

/** Coerce a stored CSS hex value into a value accepted by <input type="color">. */
export function toColorInputValue(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{4}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-fA-F]{8}$/.test(raw)) return raw.slice(0, 7).toLowerCase();
  return '#000000';
}

export function createDefaultAppearance() {
  return clone(DEFAULT_APPEARANCE);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

function asOverlay(value, fallback) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1, Math.max(0, number));
}

function normalizeLabels(value) {
  if (!isObject(value)) return {};
  const out = {};
  for (const [code, text] of Object.entries(value)) {
    if (typeof text === 'string') out[code] = text;
  }
  return out;
}

function withLegacyLabels(labels, label, labelVi) {
  const out = { ...labels };
  if (!out.en && label) out.en = label;
  if (!out.vi && labelVi) out.vi = labelVi;
  return out;
}

function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((link) => {
    const label = asString(link.label);
    const labelVi = asString(link.labelVi);
    return {
      label,
      labelVi,
      labels: withLegacyLabels(normalizeLabels(link.labels), label, labelVi),
      href: asString(link.href),
    };
  });
}

function normalizeNavLink(link) {
  const label = asString(link.label);
  const labelVi = asString(link.labelVi);
  return {
    label,
    labelVi,
    labels: withLegacyLabels(normalizeLabels(link.labels), label, labelVi),
    href: asString(link.href),
    links: Array.isArray(link.links)
      ? link.links.filter(isObject).map(normalizeNavLink)
      : [],
  };
}

function normalizeNavigation(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map(normalizeNavLink);
}

function normalizePages(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((page) => {
    const title = asString(page.title);
    const titleVi = asString(page.titleVi);
    return {
      slug: asString(page.slug),
      title,
      titleVi,
      titles: withLegacyLabels(normalizeLabels(page.titles), title, titleVi),
      content: asString(page.content),
    };
  });
}

function normalizeColors(value) {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(
    COLOR_KEYS.map((key) => [key, asString(source[key], DEFAULT_APPEARANCE.colors[key])]),
  );
}

function normalizeFonts(value) {
  const source = isObject(value) ? value : {};
  return Object.fromEntries(
    FONT_KEYS.map((key) => [key, asString(source[key], DEFAULT_APPEARANCE.fonts[key])]),
  );
}

/** Fill every field with a default, keeping valid unknown shapes out of the payload. */
export function normalizeAppearance(value) {
  const source = isObject(value) ? value : {};
  const background = isObject(source.background) ? source.background : {};
  const header = isObject(source.header) ? source.header : {};
  const footer = isObject(source.footer) ? source.footer : {};
  const cookie = isObject(source.cookie) ? source.cookie : {};
  const defaults = DEFAULT_APPEARANCE;

  return {
    colors: normalizeColors(source.colors),
    fonts: normalizeFonts(source.fonts),
    background: {
      image: asString(background.image, defaults.background.image),
      color: asString(background.color, defaults.background.color),
      overlay: asOverlay(background.overlay, defaults.background.overlay),
      fixed: asBool(background.fixed, defaults.background.fixed),
    },
    header: {
      show: asBool(header.show, defaults.header.show),
      sticky: asBool(header.sticky, defaults.header.sticky),
      showSearch: asBool(header.showSearch, defaults.header.showSearch),
      showLanguage: asBool(header.showLanguage, defaults.header.showLanguage),
      background: asString(header.background, defaults.header.background),
      text: asString(header.text, defaults.header.text),
      ctaLabel: asString(header.ctaLabel, defaults.header.ctaLabel),
      ctaLabelVi: asString(header.ctaLabelVi, defaults.header.ctaLabelVi),
      ctaLabels: withLegacyLabels(
        normalizeLabels(header.ctaLabels),
        asString(header.ctaLabel, defaults.header.ctaLabel),
        asString(header.ctaLabelVi, defaults.header.ctaLabelVi),
      ),
      ctaUrl: asString(header.ctaUrl, defaults.header.ctaUrl),
    },
    theme: {
      default: ['system', 'light', 'dark'].includes(source.theme?.default)
        ? source.theme.default
        : defaults.theme.default,
      options: Array.isArray(source.theme?.options)
        ? [...new Set(source.theme.options.filter((value) => ['system', 'light', 'dark'].includes(value)))]
        : defaults.theme.options,
    },
    footer: {
      show: asBool(footer.show, defaults.footer.show),
      background: asString(footer.background, defaults.footer.background),
      text: asString(footer.text, defaults.footer.text),
      copyright: asString(footer.copyright, defaults.footer.copyright),
      note: asString(footer.note, defaults.footer.note),
      links: normalizeLinks(footer.links),
      products: normalizeLinks(footer.products),
    },
    navigation: normalizeNavigation(source.navigation),
    pages: normalizePages(source.pages),
    cookie: {
      enabled: asBool(cookie.enabled, defaults.cookie.enabled),
      title: asString(cookie.title, defaults.cookie.title),
      description: asString(cookie.description, defaults.cookie.description),
      necessaryTitle: asString(cookie.necessaryTitle, defaults.cookie.necessaryTitle),
      necessaryDescription: asString(cookie.necessaryDescription, defaults.cookie.necessaryDescription),
      analyticsEnabled: asBool(cookie.analyticsEnabled, defaults.cookie.analyticsEnabled),
      analyticsDefault: asBool(cookie.analyticsDefault, defaults.cookie.analyticsDefault),
      analyticsTitle: asString(cookie.analyticsTitle, defaults.cookie.analyticsTitle),
      analyticsDescription: asString(cookie.analyticsDescription, defaults.cookie.analyticsDescription),
      marketingEnabled: asBool(cookie.marketingEnabled, defaults.cookie.marketingEnabled),
      marketingDefault: asBool(cookie.marketingDefault, defaults.cookie.marketingDefault),
      marketingTitle: asString(cookie.marketingTitle, defaults.cookie.marketingTitle),
      marketingDescription: asString(cookie.marketingDescription, defaults.cookie.marketingDescription),
      policyText: asString(cookie.policyText, defaults.cookie.policyText),
      policyUrl: asString(cookie.policyUrl, defaults.cookie.policyUrl),
      acceptAllText: asString(cookie.acceptAllText, defaults.cookie.acceptAllText),
      onlyNecessaryText: asString(cookie.onlyNecessaryText, defaults.cookie.onlyNecessaryText),
      saveText: asString(cookie.saveText, defaults.cookie.saveText),
      closeText: asString(cookie.closeText, defaults.cookie.closeText),
      footerText: asString(cookie.footerText, defaults.cookie.footerText),
    },
  };
}

function trim(value) {
  return value.trim();
}

function cleanLink(link) {
  return {
    label: trim(link.label),
    labelVi: trim(link.labelVi),
    labels: Object.fromEntries(
      Object.entries(link.labels || {}).map(([code, text]) => [code, trim(text)]),
    ),
    href: trim(link.href),
  };
}

function cleanNavLink(link) {
  return {
    ...cleanLink(link),
    links: Array.isArray(link.links) ? link.links.map(cleanNavLink) : [],
  };
}

/** Build the exact object sent to PUT /admin/appearance. */
export function buildAppearancePayload(value) {
  const normalized = normalizeAppearance(value);

  return {
    colors: Object.fromEntries(
      COLOR_KEYS.map((key) => [key, trim(normalized.colors[key])]),
    ),
    fonts: {
      body: trim(normalized.fonts.body),
      heading: trim(normalized.fonts.heading),
      baseSize: trim(normalized.fonts.baseSize),
      googleFontsUrl: trim(normalized.fonts.googleFontsUrl),
    },
    background: {
      image: trim(normalized.background.image),
      color: trim(normalized.background.color),
      overlay: normalized.background.overlay,
      fixed: normalized.background.fixed,
    },
    header: {
      show: normalized.header.show,
      sticky: normalized.header.sticky,
      showSearch: normalized.header.showSearch,
      showLanguage: normalized.header.showLanguage,
      background: trim(normalized.header.background),
      text: trim(normalized.header.text),
      ctaLabel: trim(normalized.header.ctaLabel),
      ctaLabelVi: trim(normalized.header.ctaLabelVi),
      ctaLabels: Object.fromEntries(
        Object.entries(normalized.header.ctaLabels || {}).map(([code, text]) => [
          code,
          trim(text),
        ]),
      ),
      ctaUrl: trim(normalized.header.ctaUrl),
    },
    theme: {
      default: normalized.theme.default,
      options: normalized.theme.options.length
        ? normalized.theme.options
        : ['system'],
    },
    footer: {
      show: normalized.footer.show,
      background: trim(normalized.footer.background),
      text: trim(normalized.footer.text),
      copyright: trim(normalized.footer.copyright),
      note: trim(normalized.footer.note),
      links: normalized.footer.links.map(cleanLink),
      products: normalized.footer.products.map(cleanLink),
    },
    navigation: normalized.navigation.map((item) => ({
      label: trim(item.label),
      labelVi: trim(item.labelVi),
      labels: Object.fromEntries(
        Object.entries(item.labels || {}).map(([code, text]) => [code, trim(text)]),
      ),
      href: trim(item.href),
      links: item.links.map(cleanNavLink),
    })),
    pages: normalized.pages.map((page) => ({
      slug: trim(page.slug),
      title: trim(page.title),
      titleVi: trim(page.titleVi),
      titles: Object.fromEntries(
        Object.entries(page.titles || {}).map(([code, text]) => [code, trim(text)]),
      ),
      content: page.content,
    })),
    cookie: {
      enabled: normalized.cookie.enabled,
      title: trim(normalized.cookie.title),
      description: trim(normalized.cookie.description),
      necessaryTitle: trim(normalized.cookie.necessaryTitle),
      necessaryDescription: trim(normalized.cookie.necessaryDescription),
      analyticsEnabled: normalized.cookie.analyticsEnabled,
      analyticsDefault: normalized.cookie.analyticsDefault,
      analyticsTitle: trim(normalized.cookie.analyticsTitle),
      analyticsDescription: trim(normalized.cookie.analyticsDescription),
      marketingEnabled: normalized.cookie.marketingEnabled,
      marketingDefault: normalized.cookie.marketingDefault,
      marketingTitle: trim(normalized.cookie.marketingTitle),
      marketingDescription: trim(normalized.cookie.marketingDescription),
      policyText: trim(normalized.cookie.policyText),
      policyUrl: trim(normalized.cookie.policyUrl),
      acceptAllText: trim(normalized.cookie.acceptAllText),
      onlyNecessaryText: trim(normalized.cookie.onlyNecessaryText),
      saveText: trim(normalized.cookie.saveText),
      closeText: trim(normalized.cookie.closeText),
      footerText: trim(normalized.cookie.footerText),
    },
  };
}
