import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');
const STORAGE_KEY = 'webdoc_lang';
const FALLBACK_LANG = 'en';

const messageCache = new Map();

let activeMessages = {};
let activeDefaultMessages = {};

function readStoredLang() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}
const BUILTIN_MESSAGES = {
  vi: {
    'nav.cmsSettings': 'Cài đặt CMS',
    'cms.title': 'Cài đặt CMS',
    'cms.subtitle': 'Tùy biến thương hiệu, logo, màu sắc và giao diện cho riêng hệ thống quản trị CMS.',
    'cms.save': 'Lưu cấu hình',
    'cms.saving': 'Đang lưu…',
    'cms.saveSuccess': 'Đã lưu cấu hình CMS thành công.',
    'cms.reset': 'Khôi phục mặc định',
    'cms.resetConfirm': 'Bạn có chắc chắn muốn đặt lại toàn bộ cài đặt giao diện CMS về mặc định?',
    'cms.resetSuccess': 'Đã đặt lại cấu hình CMS về mặc định.',
    'cms.tabBrand': 'Thương hiệu & Logo',
    'cms.tabColors': 'Màu sắc giao diện',
    'cms.tabLogin': 'Màn hình đăng nhập',
    'cms.brandName': 'Tên thương hiệu CMS',
    'cms.brandNameHint': 'Hiển thị trên thanh bên, tiêu đề trang và màn hình đăng nhập.',
    'cms.brandSubname': 'Tiêu đề phụ',
    'cms.brandSubnameHint': 'Dòng mô tả ngắn dưới tên thương hiệu.',
    'cms.logo': 'Logo CMS',
    'cms.logoHint': 'Tải lên ảnh logo (PNG, SVG, WEBP) hoặc dán link ảnh logo.',
    'cms.logoUpload': 'Tải ảnh logo',
    'cms.logoRemove': 'Xóa logo',
    'cms.logoChar': 'Ký tự biểu trưng',
    'cms.logoCharHint': 'Ký tự hiển thị trong khối biểu trưng khi không dùng ảnh logo.',
    'cms.favicon': 'Favicon CMS',
    'cms.faviconHint': 'Biểu tượng tab trình duyệt cho trang quản trị CMS.',
    'cms.faviconUpload': 'Tải favicon',
    'cms.footerText': 'Ghi chú chân trang CMS',
    'cms.footerTextHint': 'Văn bản bản quyền hoặc ghi chú hiển thị ở chân thanh bên và màn hình đăng nhập.',
    'cms.presets': 'Bảng màu doanh nghiệp mẫu',
    'cms.primaryColor': 'Màu chủ đạo (Primary / Accent)',
    'cms.primaryDarkColor': 'Màu chủ đạo khi hover / nhấn',
    'cms.accentDarkColor': 'Màu chủ đạo chế độ Tối (Dark mode)',
    'cms.sidebarBg': 'Màu nền thanh bên (Sidebar)',
    'cms.sidebarText': 'Màu chữ thanh bên',
    'cms.topbarBg': 'Màu nền thanh trên (Topbar)',
    'cms.topbarText': 'Màu chữ thanh trên',
    'cms.loginWelcome': 'Tiêu đề chào mừng trên banner',
    'cms.loginDescription': 'Mô tả chi tiết trên banner',
    'cms.loginCardTitle': 'Tiêu đề thẻ đăng nhập',
    'cms.loginCardSubtitle': 'Phụ đề thẻ đăng nhập',
    'cms.loginPanelBg': 'Màu nền khung đăng nhập (login-panel)',
    'cms.loginPanelBgHint': 'Màu nền hoặc dải màu (gradient) của khung banner bên trái màn hình đăng nhập.',
    'cms.loginPanelBgDefault': 'Mặc định (Teal)',
    'cms.loginPanelPresets': 'Dải màu mẫu login-panel',
    'cms.previewLogin': 'Xem trước màn hình đăng nhập',
    'cms.previewLoginDesc': 'Xem trước khung banner giới thiệu và thẻ đăng nhập với màu nền và thông tin đã chọn.',
    'cms.preview': 'Xem trước trực quan',
    'cms.previewDesc': 'Xem trước thanh bên và thanh trên với màu sắc và logo đã chọn.',
    'site.skipHomepage': 'Bỏ qua trang chủ (truy cập thẳng cây tài liệu)',
    'site.skipHomepageHint': 'Khi bật, người dùng truy cập website sẽ tự động bỏ qua trang chủ và chuyển hướng trực tiếp đến trang đầu tiên trong cây thư mục.',
    'appearance.headerShowNavigation': 'Hiện điều hướng',
    'docs.show': 'Hiển thị trên website',
    'docs.showAria': 'Hiển thị {title} trên website',
    'docs.hide': 'Ẩn trên website',
    'docs.hideAria': 'Ẩn {title} trên website',
    'docs.publishSuccess': 'Đã hiển thị “{title}” trên website.',
    'docs.hideSuccess': 'Đã ẩn “{title}” trên website.',
    'docs.toggleError': 'Không thể thay đổi trạng thái hiển thị.',
  },
  en: {
    'nav.cmsSettings': 'CMS Settings',
    'cms.title': 'CMS Settings',
    'cms.subtitle': 'Customize branding, logo, colors and interface for the admin CMS.',
    'cms.save': 'Save settings',
    'cms.saving': 'Saving…',
    'cms.saveSuccess': 'CMS settings saved successfully.',
    'cms.reset': 'Reset to defaults',
    'cms.resetConfirm': 'Are you sure you want to reset all CMS appearance settings to defaults?',
    'cms.resetSuccess': 'CMS settings reset to defaults.',
    'cms.tabBrand': 'Branding & Logo',
    'cms.tabColors': 'Colors & Styling',
    'cms.tabLogin': 'Login Screen',
    'cms.brandName': 'CMS Brand Name',
    'cms.brandNameHint': 'Displayed in the sidebar, browser title and login page.',
    'cms.brandSubname': 'Subtitle',
    'cms.brandSubnameHint': 'Short subtitle below the brand name.',
    'cms.logo': 'CMS Logo',
    'cms.logoHint': 'Upload a logo image (PNG, SVG, WEBP) or paste an image URL.',
    'cms.logoUpload': 'Upload logo',
    'cms.logoRemove': 'Remove logo',
    'cms.logoChar': 'Logo Mark Character',
    'cms.logoCharHint': 'Character shown in the brand mark box when no logo image is set.',
    'cms.favicon': 'CMS Favicon',
    'cms.faviconHint': 'Browser tab icon for the admin CMS.',
    'cms.faviconUpload': 'Upload favicon',
    'cms.footerText': 'CMS Footer Note',
    'cms.footerTextHint': 'Copyright or custom footnote shown at the bottom of the sidebar and login page.',
    'cms.presets': 'Color Presets',
    'cms.primaryColor': 'Primary / Accent Color',
    'cms.primaryDarkColor': 'Primary Hover / Dark Shade',
    'cms.accentDarkColor': 'Dark Mode Accent Color',
    'cms.sidebarBg': 'Sidebar Background',
    'cms.sidebarText': 'Sidebar Text Color',
    'cms.topbarBg': 'Topbar Background',
    'cms.topbarText': 'Topbar Text Color',
    'cms.loginWelcome': 'Login Banner Heading',
    'cms.loginDescription': 'Login Banner Description',
    'cms.loginCardTitle': 'Login Card Title',
    'cms.loginCardSubtitle': 'Login Card Subtitle',
    'cms.loginPanelBg': 'Login panel background (login-panel)',
    'cms.loginPanelBgHint': 'Background color or gradient for the intro banner on the login screen.',
    'cms.loginPanelBgDefault': 'Default (Teal)',
    'cms.loginPanelPresets': 'Login panel gradient presets',
    'cms.previewLogin': 'Login screen preview',
    'cms.previewLoginDesc': 'Preview the login banner and sign-in card with your chosen background and text.',
    'cms.preview': 'Live Preview',
    'cms.previewDesc': 'Preview of the sidebar and topbar with your chosen logo and colors.',
    'site.skipHomepage': 'Bypass homepage (direct to documentation)',
    'site.skipHomepageHint': 'When enabled, visiting the website will automatically skip the homepage and navigate directly to the first document in the content tree.',
    'site.docsAccordion': 'Auto-collapse peer sections on link click',
    'site.docsAccordionHint': 'When clicking a major section link, automatically collapse other peer sections. Clicking expand arrows keeps multiple sections open.',
    'appearance.headerShowNavigation': 'Show navigation',
    'docs.show': 'Show on website',
    'docs.showAria': 'Show {title} on website',
    'docs.hide': 'Hide from website',
    'docs.hideAria': 'Hide {title} from website',
    'docs.publishSuccess': '“{title}” is now visible on the website.',
    'docs.hideSuccess': '“{title}” is now hidden from the website.',
    'docs.toggleError': 'Unable to change visibility.',
  },
};
function writeStoredLang(lang) {
  try {
    if (lang) window.localStorage.setItem(STORAGE_KEY, lang);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    let message = '';
    try {
      const data = await response.json();
      if (data && typeof data.error === 'string') message = data.error;
    } catch {
      /* ignore malformed error body */
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json();
}

function normalizeConfig(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.locales || payload?.items || [];

  const locales = raw
    .filter(
      (item) =>
        item &&
        typeof item.code === 'string' &&
        item.code.trim() &&
        item.enabled !== false,
    )
    .map((item) => ({
      code: item.code.trim(),
      name: item.name || item.code.trim(),
      order: Number(item.order) || 0,
      isDefault: Boolean(item.isDefault),
    }))
    .sort(
      (a, b) =>
        a.order - b.order || a.code.localeCompare(b.code),
    );

  const explicitDefault =
    !Array.isArray(payload) && typeof payload?.defaultLocale === 'string'
      ? payload.defaultLocale
      : '';
  const defaultLocale =
    explicitDefault ||
    locales.find((locale) => locale.isDefault)?.code ||
    locales[0]?.code ||
    FALLBACK_LANG;

  return { locales, defaultLocale };
}

async function fetchMessages(code) {
  if (!code) return {};
  if (messageCache.has(code)) return messageCache.get(code);
  const data = await fetchJson(`/i18n/${encodeURIComponent(code)}`);
  const adminDict =
    data && typeof data.admin === 'object' && data.admin ? data.admin : {};
  const uiDict =
    data && typeof data.ui === 'object' && data.ui ? data.ui : {};
  const dictionary = { ...uiDict, ...adminDict };
  messageCache.set(code, dictionary);
  return dictionary;
}

function translateWith(current, fallback, key, vars) {
  let value = current ? current[key] : undefined;
  if (value === undefined) value = fallback ? fallback[key] : undefined;
  if (value === undefined) {
    const lang = readStoredLang() || FALLBACK_LANG;
    const dict = BUILTIN_MESSAGES[lang] || BUILTIN_MESSAGES.en;
    value = dict[key] || BUILTIN_MESSAGES.vi[key] || BUILTIN_MESSAGES.en[key];
  }
  if (value === undefined) return key;
  if (typeof value !== 'string') value = String(value);
  if (vars) {
    value = value.replace(/\{(\w+)\}/g, (match, name) =>
      vars[name] === undefined || vars[name] === null ? match : String(vars[name]),
    );
  }
  return value;
}

/** Translate outside of React (e.g. lib/api.js) using the active language. */
export function translateCurrent(key, vars) {
  return translateWith(activeMessages, activeDefaultMessages, key, vars);
}

function intlLocale(code) {
  if (code === 'vi') return 'vi-VN';
  if (code === 'en') return 'en-US';
  return code;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const [state, setState] = useState(() => ({
    lang: readStoredLang() || FALLBACK_LANG,
    locales: [],
    defaultLocale: FALLBACK_LANG,
    messages: {},
    ready: false,
  }));
  const langRef = useRef(state.lang);
  const messagesRef = useRef(state.messages);
  const requestRef = useRef(0);
  const startedRef = useRef(false);

  const load = useCallback(async (preferredLang) => {
    const requestId = ++requestRef.current;

    let config;
    try {
      config = normalizeConfig(await fetchJson('/i18n'));
    } catch {
      if (requestId !== requestRef.current) return;
      setState((current) => ({ ...current, ready: true }));
      return;
    }

    if (requestId !== requestRef.current) return;

    const codes = new Set(config.locales.map((locale) => locale.code));
    let nextLang = preferredLang;
    if (!nextLang || !codes.has(nextLang)) {
      const stored = readStoredLang();
      nextLang = codes.has(stored) ? stored : config.defaultLocale;
    }
    if (!codes.has(nextLang)) {
      nextLang = config.locales[0]?.code || config.defaultLocale;
    }

    const targets = [fetchMessages(config.defaultLocale)];
    if (nextLang !== config.defaultLocale) targets.push(fetchMessages(nextLang));

    let messages = {};
    const results = await Promise.allSettled(targets);
    if (results[0]?.status === 'fulfilled') {
      messages[config.defaultLocale] = results[0].value;
    }
    if (nextLang !== config.defaultLocale && results[1]?.status === 'fulfilled') {
      messages[nextLang] = results[1].value;
    }

    if (requestId !== requestRef.current) return;

    langRef.current = nextLang;
    messagesRef.current = messages;
    writeStoredLang(nextLang);
    setState({
      lang: nextLang,
      locales: config.locales,
      defaultLocale: config.defaultLocale,
      messages,
      ready: true,
    });
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load(readStoredLang());
  }, [load]);

  useEffect(() => {
    if (state.lang) document.documentElement.lang = state.lang;
    activeMessages = state.messages[state.lang] || {};
    activeDefaultMessages = state.messages[state.defaultLocale] || {};
  }, [state.lang, state.messages, state.defaultLocale]);

  const setLang = useCallback(
    async (next) => {
      if (!next || next === langRef.current) return;
      if (!state.locales.some((locale) => locale.code === next)) return;

      langRef.current = next;
      writeStoredLang(next);
      setState((current) => ({ ...current, lang: next }));

      if (messagesRef.current[next]) return;
      const requestId = requestRef.current;
      try {
        const dictionary = await fetchMessages(next);
        if (requestId !== requestRef.current) return;
        messagesRef.current = {
          ...messagesRef.current,
          [next]: dictionary,
        };
        setState((current) => ({
          ...current,
          messages: messagesRef.current,
        }));
      } catch {
        /* fall back to the default locale (or the key) */
      }
    },
    [state.locales],
  );

  const reload = useCallback(async () => {
    messageCache.clear();
    await load(langRef.current);
  }, [load]);

  const t = useCallback(
    (key, vars) =>
      translateWith(
        state.messages[state.lang],
        state.messages[state.defaultLocale],
        key,
        vars,
      ),
    [state.lang, state.messages, state.defaultLocale],
  );

  const locale = intlLocale(state.lang);

  const value = useMemo(
    () => ({
      lang: state.lang,
      locale,
      setLang,
      t,
      locales: state.locales,
      defaultLocale: state.defaultLocale,
      ready: state.ready,
      reload,
    }),
    [
      state.lang,
      state.locales,
      state.defaultLocale,
      state.ready,
      locale,
      setLang,
      t,
      reload,
    ],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
