import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { useContent } from '../lib/ContentContext'

const STORAGE_KEY = 'webdoc_theme'
const CONFIG_KEY = 'webdoc_theme_config'
const MODES = ['system', 'light', 'dark']
const ThemeContext = createContext(null)

function storedMode() {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(value) ? value : ''
  } catch {
    return ''
  }
}

/* index.html resolves the theme before the first paint and records the mode on
   <html>. Reuse that result so the provider starts with the same mode. */
function bootMode() {
  if (typeof document === 'undefined') return ''
  const value = document.documentElement.dataset.themeMode
  return MODES.includes(value) ? value : ''
}

function systemPrefersDark() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function ThemeProvider({ children }) {
  const { appearance, loading, appearanceLoaded } = useContent()
  const config = appearance?.theme || {}
  const options = useMemo(() => {
    const values = Array.isArray(config.options) ? config.options : []
    const filtered = [...new Set(values.filter((value) => MODES.includes(value)))]
    return filtered.length ? filtered : ['system']
  }, [config.options])
  const configuredDefault = options.includes(config.default) ? config.default : options[0]
  const [mode, setModeState] = useState(() => bootMode() || storedMode() || configuredDefault)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)
  // No cached config and no saved choice means the appearance API has not told
  // us which modes exist yet. Hold the theme instead of flashing "system".
  const booted = Boolean(bootMode()) || !loading

  useEffect(() => {
    if (!options.includes(mode)) setModeState(configuredDefault)
  }, [configuredDefault, mode, options])

  useEffect(() => {
    if (!window.matchMedia) return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setSystemDark(event.matches)
    setSystemDark(media.matches)
    media.addEventListener?.('change', onChange)
    return () => media.removeEventListener?.('change', onChange)
  }, [])

  const resolved = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    if (!appearanceLoaded) return
    try {
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({ default: configuredDefault, options }),
      )
    } catch {
      /* ignore storage failures */
    }
  }, [appearanceLoaded, configuredDefault, options])

  useLayoutEffect(() => {
    if (!booted) return
    const root = document.documentElement
    root.dataset.theme = resolved
    root.dataset.themeMode = mode
    root.style.colorScheme = resolved
  }, [booted, mode, resolved])

  const setMode = useCallback(
    (next) => {
      if (!MODES.includes(next) || !options.includes(next)) return
      setModeState(next)
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        /* ignore storage failures */
      }
    },
    [options],
  )

  const value = useMemo(
    () => ({
      mode,
      setMode,
      options,
      resolved: booted ? resolved : 'light',
      defaultMode: configuredDefault,
    }),
    [booted, configuredDefault, mode, options, resolved, setMode],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}
