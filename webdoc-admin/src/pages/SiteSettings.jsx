import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import { useToast } from '../components/Toast';

const FIELDS = [
  {
    key: 'siteName',
    labelKey: 'site.fieldSiteName',
    placeholderKey: 'site.siteNamePlaceholder',
    kind: 'text',
  },
  {
    key: 'tagline',
    labelKey: 'site.fieldTagline',
    placeholderKey: 'site.taglinePlaceholder',
    kind: 'text',
  },
  {
    key: 'hotline',
    labelKey: 'site.fieldHotline',
    placeholderKey: 'site.hotlinePlaceholder',
    kind: 'text',
  },
  {
    key: 'email',
    labelKey: 'site.fieldEmail',
    placeholderKey: 'site.emailPlaceholder',
    kind: 'email',
  },
  {
    key: 'address',
    labelKey: 'site.fieldAddress',
    placeholderKey: 'site.addressPlaceholder',
    kind: 'text',
  },
  {
    key: 'facebook',
    labelKey: 'site.fieldFacebook',
    placeholderKey: 'site.facebookPlaceholder',
    kind: 'url',
  },
  {
    key: 'youtube',
    labelKey: 'site.fieldYoutube',
    placeholderKey: 'site.youtubePlaceholder',
    kind: 'url',
  },
];

const IMAGE_FIELDS = [
  {
    key: 'headerLogo',
    labelKey: 'site.headerLogo',
    hintKey: 'site.headerLogoHint',
  },
  {
    key: 'footerLogo',
    labelKey: 'site.footerLogo',
    hintKey: 'site.footerLogoHint',
  },
  {
    key: 'favicon',
    labelKey: 'site.favicon',
    hintKey: 'site.faviconHint',
  },
  {
    key: 'ogImage',
    labelKey: 'site.ogImage',
    hintKey: 'site.ogImageHint',
  },
];

const EMPTY_SITE = {
  siteName: '',
  tagline: '',
  hotline: '',
  email: '',
  address: '',
  facebook: '',
  youtube: '',
  footerText: '',
  headerLogo: '',
  footerLogo: '',
  favicon: '',
  ogImage: '',
};

function ImageField({ field, value, onChange }) {
  const { t } = useI18n();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const data = await api.upload(file);
      onChange(data.url);
    } catch (err) {
      setError(err.message || t('site.uploadError'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="image-field">
      <div className="image-field-preview">
        {value ? (
          <img src={value} alt={t(field.labelKey)} />
        ) : (
          <Icon name="upload" size={20} />
        )}
      </div>
      <div className="image-field-body">
        <span className="image-field-label">{t(field.labelKey)}</span>
        <input
          type="text"
          value={value}
          placeholder={t('site.imageUrlPlaceholder')}
          onChange={(event) => onChange(event.target.value)}
        />
        <small>{t(field.hintKey)}</small>
        {error && <span className="field-error">{error}</span>}
      </div>
      <div className="image-field-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? t('site.uploading') : t('site.upload')}
        </button>
        {value && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
            {t('site.remove')}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="visually-hidden"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}

export default function SiteSettings() {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_SITE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getSite();
      setForm({
        siteName: data?.siteName || '',
        tagline: data?.tagline || '',
        hotline: data?.hotline || '',
        email: data?.email || '',
        address: data?.address || '',
        facebook: data?.facebook || '',
        youtube: data?.youtube || '',
        footerText: data?.footerText || '',
        headerLogo: data?.headerLogo || '',
        footerLogo: data?.footerLogo || '',
        favicon: data?.favicon || '',
        ogImage: data?.ogImage || '',
      });
    } catch (err) {
      setError(err.message || t('site.error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t('site.invalidEmail'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        siteName: form.siteName.trim(),
        tagline: form.tagline.trim(),
        hotline: form.hotline.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        facebook: form.facebook.trim(),
        youtube: form.youtube.trim(),
        footerText: form.footerText,
        headerLogo: form.headerLogo.trim(),
        footerLogo: form.footerLogo.trim(),
        favicon: form.favicon.trim(),
        ogImage: form.ogImage.trim(),
      };
      await api.updateSite(payload);
      toast.success(t('site.saved'));
    } catch (err) {
      setError(err.message || t('site.saveError'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="panel empty-state">{t('site.loading')}</div>
      </div>
    );
  }

  return (
    <form className="page" onSubmit={handleSubmit}>
      <div className="page-head">
        <div>
          <h2>{t('site.title')}</h2>
          <p>{t('site.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={saving}>
            {t('site.restore')}
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('site.save')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <section className="panel form-stack">
        <h3 className="panel-title">{t('site.imagesTitle')}</h3>
        <p className="panel-desc">{t('site.imagesDesc')}</p>
        <div className="image-settings-grid">
          {IMAGE_FIELDS.map((field) => (
            <ImageField
              key={field.key}
              field={field}
              value={form[field.key]}
              onChange={(value) => update(field.key, value)}
            />
          ))}
        </div>
      </section>

      <div className="settings-grid">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('site.generalTitle')}</h3>
          <p className="panel-desc">{t('site.generalDesc')}</p>

          {FIELDS.slice(0, 2).map((field) => (
            <label className="field" key={field.key}>
              <span>{t(field.labelKey)}</span>
              <input
                type={field.kind}
                value={form[field.key]}
                placeholder={t(field.placeholderKey)}
                onChange={(event) => update(field.key, event.target.value)}
              />
            </label>
          ))}

          <label className="field">
            <span>{t('site.footerContent')}</span>
            <textarea
              rows={4}
              value={form.footerText}
              placeholder={t('site.footerPlaceholder')}
              onChange={(event) => update('footerText', event.target.value)}
            />
            <small className="field-hint">{t('site.footerHint')}</small>
          </label>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('site.contactTitle')}</h3>
          <p className="panel-desc">{t('site.contactDesc')}</p>

          {FIELDS.slice(2).map((field) => (
            <label className="field" key={field.key}>
              <span>{t(field.labelKey)}</span>
              <input
                type={field.kind}
                value={form[field.key]}
                placeholder={t(field.placeholderKey)}
                onChange={(event) => update(field.key, event.target.value)}
              />
            </label>
          ))}
        </section>
      </div>

      <div className="sticky-save">
        <span className="sticky-save-note">
          <Icon name="settings" size={16} /> {t('site.stickyNote')}
        </span>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('common.saving') : t('site.save')}
        </button>
      </div>
    </form>
  );
}
