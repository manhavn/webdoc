import { useState } from 'react'
import { useContent } from '../lib/ContentContext'
import { api } from '../lib/api'
import { useI18n } from '../i18n/I18nContext'
import PageShell from '../components/PageShell'

export default function ContactPage() {
  const { site } = useContent()
  const { t } = useI18n()
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [state, setState] = useState({ status: 'idle', error: '' })

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setState({ status: 'sending', error: '' })
    try {
      await api.post('/contact', form)
      setState({ status: 'done', error: '' })
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setState({ status: 'error', error: err.message })
    }
  }

  return (
    <PageShell flush>
    <div className="wd-contact">
      <div className="wd-contact-hero">
        <div className="wd-container">
          <p className="wd-eyebrow">{t('contact.eyebrow')}</p>
          <h1>{t('contact.title')}</h1>
          <p className="wd-lead">{t('contact.lead')}</p>
        </div>
      </div>
      <div className="wd-container wd-contact-body">
        <div className="wd-contact-info">
          <div className="wd-contact-card">
            <i className="fas fa-phone-volume" />
            <div>
              <h3>{t('contact.hotline')}</h3>
              <a href={`tel:${site.hotline.replace(/\./g, '')}`}>{site.hotline}</a>
            </div>
          </div>
          <div className="wd-contact-card">
            <i className="fas fa-envelope" />
            <div>
              <h3>{t('contact.email')}</h3>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </div>
          </div>
          <div className="wd-contact-card">
            <i className="fas fa-map-marker-alt" />
            <div>
              <h3>{t('contact.address')}</h3>
              <p>{site.address}</p>
            </div>
          </div>
          <div className="wd-contact-card">
            <i className="fas fa-clock" />
            <div>
              <h3>{t('contact.hours')}</h3>
              <p>{t('contact.hoursValue')}</p>
            </div>
          </div>
        </div>

        <form className="wd-contact-form" onSubmit={submit}>
          <h2>{t('contact.formTitle')}</h2>
          {state.status === 'done' && (
            <div className="wd-alert wd-alert--ok">
              {t('contact.success')}
            </div>
          )}
          {state.status === 'error' && (
            <div className="wd-alert wd-alert--err">{state.error}</div>
          )}
          <label>
            {t('contact.name')} <span>*</span>
            <input
              required
              value={form.name}
              onChange={update('name')}
              placeholder={t('contact.namePlaceholder')}
            />
          </label>
          <div className="wd-form-row">
            <label>
              {t('contact.email')} <span>*</span>
              <input
                required
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder={t('contact.emailPlaceholder')}
              />
            </label>
            <label>
              {t('contact.phone')}
              <input
                value={form.phone}
                onChange={update('phone')}
                placeholder={t('contact.phonePlaceholder')}
              />
            </label>
          </div>
          <label>
            {t('contact.message')} <span>*</span>
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={update('message')}
              placeholder={t('contact.messagePlaceholder')}
            />
          </label>
          <button
            type="submit"
            className="wd-btn wd-btn--solid"
            disabled={state.status === 'sending'}
          >
            {state.status === 'sending' ? t('contact.sending') : t('contact.submit')}
          </button>
        </form>
      </div>
    </div>
    </PageShell>
  )
}
