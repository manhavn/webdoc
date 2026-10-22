import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { api } from '../lib/api'

const STORAGE_KEY = 'webdoc_lang'

/* Bundle cache shared by every provider instance so remounts and locale
   switches never refetch a dictionary that is already available. */
const bundleCache = new Map()
const pendingBundles = new Map()

function readStoredLang() {
  try {
    return localStorage.getItem(STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

function persistLang(code) {
  if (!code) return
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* storage unavailable */
  }
}

function interpolate(template, vars) {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
  )
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (locale) =>
        locale &&
        locale.enabled !== false &&
        locale.uiEnabled !== false &&
        typeof locale.code === 'string' &&
        locale.code.trim(),
    )
    .map((locale) => {
      const code = locale.code.trim()
      const name =
        typeof locale.name === 'string' && locale.name.trim()
          ? locale.name.trim()
          : code
      const order = Number(locale.order)
      return { code, name, order: Number.isFinite(order) ? order : 0 }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
}

function normalizeBundle(data, fallbackCode) {
  const raw = data && typeof data === 'object' ? data : {}
  const ui = {}
  if (raw.ui && typeof raw.ui === 'object') {
    for (const [key, value] of Object.entries(raw.ui)) {
      if (typeof value === 'string') ui[key] = value
    }
  }
  const code =
    typeof raw.code === 'string' && raw.code ? raw.code : fallbackCode
  const name =
    typeof raw.name === 'string' && raw.name ? raw.name : fallbackCode
  const admin = raw.admin && typeof raw.admin === 'object' ? raw.admin : {}
  return { code, name, ui, admin }
}

function loadBundle(code) {
  if (!code) return Promise.resolve(null)
  if (bundleCache.has(code)) return Promise.resolve(bundleCache.get(code))
  if (pendingBundles.has(code)) return pendingBundles.get(code)

  const request = api
    .get(`/i18n/${encodeURIComponent(code)}`)
    .then((data) => {
      const bundle = normalizeBundle(data, code)
      bundleCache.set(code, bundle)
      return bundle
    })
    .finally(() => {
      pendingBundles.delete(code)
    })

  pendingBundles.set(code, request)
  return request
}

async function loadBundles(codes) {
  const entries = await Promise.all(
    codes.map(async (code) => {
      try {
        return [code, await loadBundle(code)]
      } catch {
        return [code, null]
      }
    }),
  )
  const loaded = {}
  for (const [code, bundle] of entries) {
    if (bundle) loaded[code] = bundle
  }
  return loaded
}

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState('')
  const [locales, setLocales] = useState([])
  const [defaultLocale, setDefaultLocale] = useState('')
  const [fallbackLocale, setFallbackLocale] = useState('')
  const [bundles, setBundles] = useState({})
  const [ready, setReady] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const generation = useRef(0)
  const localesRef = useRef(locales)
  const defaultLocaleRef = useRef(defaultLocale)
  const fallbackRef = useRef(fallbackLocale)
  const mounted = useRef(true)

  useEffect(() => {
    localesRef.current = locales
  }, [locales])

  useEffect(() => {
    defaultLocaleRef.current = defaultLocale
  }, [defaultLocale])

  useEffect(() => {
    fallbackRef.current = fallbackLocale
  }, [fallbackLocale])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    const token = ++generation.current
    let alive = true
    setReady(false)

    async function bootstrap() {
      let config = null
      try {
        config = await api.get('/i18n')
      } catch {
        config = null
      }
      if (!alive || token !== generation.current) return

      const nextLocales = normalizeLocales(config && config.locales)
      const codes = nextLocales.map((locale) => locale.code)
      const globalDefault =
        config && typeof config.defaultLocale === 'string'
          ? config.defaultLocale.trim()
          : ''
      const configuredDefault =
        config && typeof config.uiDefaultLocale === 'string'
          ? config.uiDefaultLocale.trim()
          : globalDefault
      const nextDefault = codes.includes(configuredDefault)
        ? configuredDefault
        : codes.includes(globalDefault)
          ? globalDefault
          : codes[0] || configuredDefault || ''
      const nextFallback = globalDefault || nextDefault
      const stored = readStoredLang()
      const nextLang = codes.includes(stored)
        ? stored
        : codes.includes(nextDefault)
          ? nextDefault
          : codes[0] || stored || nextDefault

      const loaded = await loadBundles(
        [...new Set([nextLang, nextFallback].filter(Boolean))],
      )
      if (!alive || token !== generation.current) return

      if (nextLocales.length > 0 && stored !== nextLang) persistLang(nextLang)
      setLangState(nextLang)
      setLocales(nextLocales)
      setDefaultLocale(nextDefault)
      setFallbackLocale(nextFallback)
      setBundles((prev) => ({ ...prev, ...loaded }))
      setReady(true)
    }

    bootstrap()

    return () => {
      alive = false
    }
  }, [reloadToken])

  useEffect(() => {
    if (lang) document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next) => {
    if (!next) return
    const enabled = localesRef.current
    if (enabled.length > 0 && !enabled.some((locale) => locale.code === next)) {
      return
    }
    const token = generation.current
    setLangState(next)
    persistLang(next)

    const fallback = fallbackRef.current
    loadBundles([...new Set([next, fallback].filter(Boolean))]).then(
      (loaded) => {
        if (!mounted.current || token !== generation.current) return
        setBundles((prev) => ({ ...prev, ...loaded }))
      },
    )
  }, [])

  const reload = useCallback(() => {
    generation.current += 1
    bundleCache.clear()
    pendingBundles.clear()
    setReady(false)
    setReloadToken((value) => value + 1)
  }, [])

  const t = useCallback(
    (key, vars) => {
      if (typeof key !== 'string') return key
      const current = bundles[lang] && bundles[lang].ui
      const fallback = bundles[defaultLocale] && bundles[defaultLocale].ui

      let value
      if (current && Object.prototype.hasOwnProperty.call(current, key)) {
        value = current[key]
      }
      if (
        (value === undefined || value === '') &&
        fallback &&
        Object.prototype.hasOwnProperty.call(fallback, key)
      ) {
        value = fallback[key]
      }
      if (value === undefined || value === null || value === '') value = key

      return interpolate(String(value), vars)
    },
    [bundles, lang, fallbackLocale],
  )

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      locales,
      defaultLocale,
      fallbackLocale,
      ready,
      reload,
    }),
    [lang, setLang, t, locales, defaultLocale, ready, reload],
  )

  return (
    <I18nContext.Provider value={value}>
      {ready ? children : null}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
