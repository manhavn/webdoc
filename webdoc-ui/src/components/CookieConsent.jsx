import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'

const STORAGE_KEY = 'ojs_cookie_consent'

export default function CookieConsent({ forceOpen = false, onClose }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState({
    necessary: true,
    analytics: true,
    marketing: false,
  })

  useEffect(() => {
    if (forceOpen) {
      setOpen(true)
      return
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [forceOpen])

  const save = (value) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ value, prefs, savedAt: new Date().toISOString() }),
      )
    } catch {
      /* storage unavailable */
    }
    setOpen(false)
    onClose?.()
  }

  if (!open) return null

  return (
    <div className="wd-cookie" role="dialog" aria-modal="true" aria-label={t('cookie.aria')}>
      <div className="wd-cookie__panel">
        <h3>{t('cookie.title')}</h3>
        <p>{t('cookie.body')}</p>
        <label className="wd-cookie__row">
          <input type="checkbox" checked disabled />
          <span>
            <strong>{t('cookie.necessary')}</strong>
            <small>{t('cookie.necessaryDesc')}</small>
          </span>
        </label>
        <label className="wd-cookie__row">
          <input
            type="checkbox"
            checked={prefs.analytics}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, analytics: e.target.checked }))
            }
          />
          <span>
            <strong>{t('cookie.analytics')}</strong>
            <small>{t('cookie.analyticsDesc')}</small>
          </span>
        </label>
        <label className="wd-cookie__row">
          <input
            type="checkbox"
            checked={prefs.marketing}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, marketing: e.target.checked }))
            }
          />
          <span>
            <strong>{t('cookie.marketing')}</strong>
            <small>{t('cookie.marketingDesc')}</small>
          </span>
        </label>
        <div className="wd-cookie__actions">
          <button type="button" className="wd-btn wd-btn--ghost" onClick={() => save({ necessary: true, analytics: false, marketing: false })}>
            {t('cookie.onlyNecessary')}
          </button>
          <button type="button" className="wd-btn" onClick={() => save(prefs)}>
            {t('cookie.save')}
          </button>
          <button type="button" className="wd-btn wd-btn--solid" onClick={() => save({ necessary: true, analytics: true, marketing: true })}>
            {t('cookie.acceptAll')}
          </button>
        </div>
        {forceOpen && (
          <button type="button" className="wd-cookie__close" onClick={() => { setOpen(false); onClose?.() }}>
            {t('cookie.close')}
          </button>
        )}
      </div>
    </div>
  )
}
