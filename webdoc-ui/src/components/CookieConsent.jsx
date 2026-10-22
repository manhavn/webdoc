import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { useContent } from '../lib/ContentContext'

const STORAGE_KEY = 'ojs_cookie_consent'

export default function CookieConsent({ forceOpen = false, onClose }) {
  const { t } = useI18n()
  const { appearance } = useContent()
  const cookie = appearance?.cookie || {}
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState(() => ({
    necessary: true,
    analytics: cookie.analyticsDefault !== false,
    marketing: Boolean(cookie.marketingDefault),
  }))

  useEffect(() => {
    if (cookie.enabled === false) {
      setOpen(false)
      return
    }
    if (forceOpen) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          const savedPrefs = parsed?.value || parsed?.prefs
          if (savedPrefs && typeof savedPrefs === 'object') {
            setPrefs({
              necessary: true,
              analytics: savedPrefs.analytics !== false,
              marketing: Boolean(savedPrefs.marketing),
            })
          }
        }
      } catch {
        /* storage unavailable */
      }
      setOpen(true)
      return
    }
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [forceOpen, cookie.enabled])

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

  if (cookie.enabled === false || !open) return null

  const title = cookie.title?.trim() || t('cookie.title')
  const description = cookie.description?.trim() || t('cookie.body')
  const policyUrl = cookie.policyUrl?.trim()
  const policyText = cookie.policyText?.trim() || 'Privacy Policy'

  const necessaryTitle = cookie.necessaryTitle?.trim() || t('cookie.necessary')
  const necessaryDesc = cookie.necessaryDescription?.trim() || t('cookie.necessaryDesc')
  const analyticsTitle = cookie.analyticsTitle?.trim() || t('cookie.analytics')
  const analyticsDesc = cookie.analyticsDescription?.trim() || t('cookie.analyticsDesc')
  const marketingTitle = cookie.marketingTitle?.trim() || t('cookie.marketing')
  const marketingDesc = cookie.marketingDescription?.trim() || t('cookie.marketingDesc')

  const onlyNecessaryText = cookie.onlyNecessaryText?.trim() || t('cookie.onlyNecessary')
  const saveText = cookie.saveText?.trim() || t('cookie.save')
  const acceptAllText = cookie.acceptAllText?.trim() || t('cookie.acceptAll')
  const closeText = cookie.closeText?.trim() || t('cookie.close')

  const showAnalytics = cookie.analyticsEnabled !== false
  const showMarketing = cookie.marketingEnabled !== false

  return (
    <div className="wd-cookie" role="dialog" aria-modal="true" aria-label={t('cookie.aria')}>
      <div className="wd-cookie__panel">
        <h3>{title}</h3>
        <p>{description}</p>
        {policyUrl && (
          <div>
            <a
              href={policyUrl}
              className="wd-cookie__policy"
              target={policyUrl.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
            >
              {policyText}
            </a>
          </div>
        )}
        <label className="wd-cookie__row">
          <input type="checkbox" checked disabled />
          <span>
            <strong>{necessaryTitle}</strong>
            <small>{necessaryDesc}</small>
          </span>
        </label>
        {showAnalytics && (
          <label className="wd-cookie__row">
            <input
              type="checkbox"
              checked={prefs.analytics}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, analytics: e.target.checked }))
              }
            />
            <span>
              <strong>{analyticsTitle}</strong>
              <small>{analyticsDesc}</small>
            </span>
          </label>
        )}
        {showMarketing && (
          <label className="wd-cookie__row">
            <input
              type="checkbox"
              checked={prefs.marketing}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, marketing: e.target.checked }))
              }
            />
            <span>
              <strong>{marketingTitle}</strong>
              <small>{marketingDesc}</small>
            </span>
          </label>
        )}
        <div className="wd-cookie__actions">
          <button
            type="button"
            className="wd-btn wd-btn--ghost"
            onClick={() => save({ necessary: true, analytics: false, marketing: false })}
          >
            {onlyNecessaryText}
          </button>
          <button type="button" className="wd-btn" onClick={() => save(prefs)}>
            {saveText}
          </button>
          <button
            type="button"
            className="wd-btn wd-btn--solid"
            onClick={() =>
              save({
                necessary: true,
                analytics: showAnalytics,
                marketing: showMarketing,
              })
            }
          >
            {acceptAllText}
          </button>
        </div>
        {forceOpen && (
          <button
            type="button"
            className="wd-cookie__close"
            onClick={() => {
              setOpen(false)
              onClose?.()
            }}
          >
            {closeText}
          </button>
        )}
      </div>
    </div>
  )
}
