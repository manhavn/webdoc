import { useI18n } from '../i18n/I18nContext'

function shortLabel(code) {
  return String(code || '').toUpperCase()
}

export default function LanguageSwitch({ className = '' }) {
  const { lang, setLang, t, locales, ready } = useI18n()

  if (!ready || locales.length <= 1) return null

  const classes = `wd-lang-switch${className ? ` ${className}` : ''}`

  if (locales.length === 2) {
    return (
      <div className={classes} role="group" aria-label={t('lang.label')}>
        {locales.map((locale) => {
          const active = lang === locale.code
          return (
            <button
              key={locale.code}
              type="button"
              className={`wd-lang-switch__btn${active ? ' is-active' : ''}`}
              aria-pressed={active}
              aria-label={locale.name}
              title={locale.name}
              onClick={() => setLang(locale.code)}
            >
              {shortLabel(locale.code)}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`${classes} wd-lang-switch--select`}>
      <select
        className="wd-lang-switch__select"
        aria-label={t('lang.label')}
        value={lang}
        onChange={(event) => setLang(event.target.value)}
      >
        {locales.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.name}
          </option>
        ))}
      </select>
    </div>
  )
}
