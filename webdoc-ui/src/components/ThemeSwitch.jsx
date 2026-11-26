import { useI18n } from '../i18n/I18nContext'
import { useTheme } from '../theme/ThemeContext'

const LABEL_KEYS = {
  system: 'theme.system',
  light: 'theme.light',
  dark: 'theme.dark',
}

// Keep the visual order consistent with the three-icon control in the navbar.
const DISPLAY_ORDER = ['light', 'dark', 'system']

function ThemeIcon({ mode }) {
  if (mode === 'light') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56m11.02 11.02 1.56 1.56M2 12h2.2m15.6 0H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
      </svg>
    )
  }

  if (mode === 'dark') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.6 8.6 0 1 0 20.2 15.3Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="18" height="13" rx="2.4" />
      <path d="M9 20h6m-3-3v3" />
    </svg>
  )
}

export default function ThemeSwitch({ className = '' }) {
  const { t } = useI18n()
  const { mode, setMode, options } = useTheme()

  if (options.length <= 1) return null

  const classes = `wd-theme-switch${className ? ` ${className}` : ''}`
  const visibleOptions = DISPLAY_ORDER.filter((option) => options.includes(option))

  return (
    <div className={classes} role="group" aria-label={t('theme.label')}>
      {visibleOptions.map((option) => (
        <button
          key={option}
          type="button"
          className={`wd-theme-switch__btn${mode === option ? ' is-active' : ''}`}
          aria-label={t(LABEL_KEYS[option])}
          aria-pressed={mode === option}
          title={t(LABEL_KEYS[option])}
          onClick={() => setMode(option)}
        >
          <ThemeIcon mode={option} />
        </button>
      ))}
    </div>
  )
}
