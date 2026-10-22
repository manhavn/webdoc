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
