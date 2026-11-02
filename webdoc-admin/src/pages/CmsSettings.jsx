import { useEffect, useRef, useState } from 'react';
import { useCms, DEFAULT_CMS_SETTINGS } from '../context/CmsContext';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import Icon from '../components/Icons';
import ConfirmDialog from '../components/ConfirmDialog';

const PRESET_PALETTES = [
  {
    name: 'Teal Doanh nghiệp',
    primary: '#0f766e',
    primaryDark: '#115e59',
    accentDark: '#2dd4bf',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #134e4a 0%, #115e59 48%, #0891b2 100%)',
  },
  {
    name: 'Xanh Dương Corporate',
    primary: '#2563eb',
    primaryDark: '#1d4ed8',
    accentDark: '#60a5fa',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #1e3a8a 0%, #1d4ed8 48%, #3b82f6 100%)',
  },
  {
    name: 'Xanh Lục Emerald',
    primary: '#059669',
    primaryDark: '#047857',
    accentDark: '#34d399',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #064e3b 0%, #047857 48%, #10b981 100%)',
  },
  {
    name: 'Tím Indigo Tech',
    primary: '#4f46e5',
    primaryDark: '#4338ca',
    accentDark: '#818cf8',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #312e81 0%, #4338ca 48%, #6366f1 100%)',
  },
  {
    name: 'Đỏ Ruby Doanh Nghiệp',
    primary: '#dc2626',
    primaryDark: '#b91c1c',
    accentDark: '#f87171',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #881337 0%, #be123c 48%, #f43f5e 100%)',
  },
  {
    name: 'Cam Amber Năng Động',
    primary: '#d97706',
    primaryDark: '#b45309',
    accentDark: '#fbbf24',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #78350f 0%, #b45309 48%, #f59e0b 100%)',
  },
  {
    name: 'Slate Tối Giản',
    primary: '#334155',
    primaryDark: '#1e293b',
    accentDark: '#94a3b8',
    sidebarBg: '#ffffff',
    sidebarText: '#0f172a',
    topbarBg: '#ffffff',
    topbarText: '#0f172a',
    loginPanelBg: 'linear-gradient(150deg, #0f172a 0%, #1e293b 48%, #334155 100%)',
  },
];

const LOGIN_PANEL_PRESETS = [
  {
    name: 'Teal mặc định',
    value: 'linear-gradient(150deg, #134e4a 0%, #115e59 48%, #0891b2 100%)',
  },
  {
    name: 'Xanh dương Corporate',
    value: 'linear-gradient(150deg, #1e3a8a 0%, #1d4ed8 48%, #3b82f6 100%)',
  },
  {
    name: 'Xanh lục Emerald',
    value: 'linear-gradient(150deg, #064e3b 0%, #047857 48%, #10b981 100%)',
  },
  {
    name: 'Tím Indigo',
    value: 'linear-gradient(150deg, #312e81 0%, #4338ca 48%, #6366f1 100%)',
  },
  {
    name: 'Đỏ Ruby',
    value: 'linear-gradient(150deg, #881337 0%, #be123c 48%, #f43f5e 100%)',
  },
  {
    name: 'Cam Amber',
    value: 'linear-gradient(150deg, #78350f 0%, #b45309 48%, #f59e0b 100%)',
  },
  {
    name: 'Slate Than chì',
    value: 'linear-gradient(150deg, #0f172a 0%, #1e293b 48%, #334155 100%)',
  },
];

function toColorValue(value, fallback = '#134e4a') {
  if (typeof value !== 'string') return fallback;
  const raw = value.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  return fallback;
}

export default function CmsSettings() {
  const { cms, updateCms, resetCms } = useCms();
  const { t } = useI18n();
  const toast = useToast();

  const [form, setForm] = useState(cms || DEFAULT_CMS_SETTINGS);
  const [activeTab, setActiveTab] = useState('brand');
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);

  useEffect(() => {
    if (cms) {
      const loginBg = cms.loginPanelBg || cms.colors?.loginPanelBg || '';
      setForm({
        ...DEFAULT_CMS_SETTINGS,
        ...cms,
        loginPanelBg: loginBg,
        colors: {
          ...DEFAULT_CMS_SETTINGS.colors,
          ...(cms.colors || {}),
          loginPanelBg: loginBg,
        },
      });
    }
  }, [cms]);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateColor(key, value) {
    setForm((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [key]: value,
      },
    }));
  }
  function updateLoginPanelBg(value) {
    setForm((current) => ({
      ...current,
      loginPanelBg: value,
      colors: {
        ...current.colors,
        loginPanelBg: value,
      },
    }));
  }


  function applyPalette(palette) {
    setForm((current) => ({
      ...current,
      loginPanelBg: palette.loginPanelBg || current.loginPanelBg || '',
      colors: {
        ...current.colors,
        primary: palette.primary,
        primaryDark: palette.primaryDark,
        accentDark: palette.accentDark,
        sidebarBg: palette.sidebarBg,
        sidebarText: palette.sidebarText,
        topbarBg: palette.topbarBg,
        topbarText: palette.topbarText,
        loginPanelBg: palette.loginPanelBg || current.colors?.loginPanelBg || '',
      },
    }));
    toast.success(`Đã áp dụng bảng màu: ${palette.name}`);
  }

  async function handleFileUpload(file, target) {
    if (!file) return;
    if (target === 'logo') setUploadingLogo(true);
    else setUploadingFavicon(true);

    try {
      const res = await api.upload(file);
      if (res?.url) {
        if (target === 'logo') {
          updateField('logoUrl', res.url);
          toast.success('Đã tải ảnh logo thành công');
        } else {
          updateField('favicon', res.url);
          toast.success('Đã tải favicon thành công');
        }
      }
    } catch (err) {
      toast.error(err.message || 'Tải ảnh thất bại');
    } finally {
      if (target === 'logo') setUploadingLogo(false);
      else setUploadingFavicon(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateCms(form);
      toast.success(t('cms.saveSuccess'));
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu cài đặt CMS');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      const def = await resetCms();
      setForm(def);
      setConfirmReset(false);
      toast.success(t('cms.resetSuccess'));
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đặt lại cài đặt CMS');
    } finally {
      setResetting(false);
    }
  }

  const primaryColor = form.colors?.primary || '#0f766e';
  const currentLoginPanelBg = form.colors?.loginPanelBg || form.loginPanelBg || '';


  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('cms.title')}</h2>
          <p className="page-desc">{t('cms.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setConfirmReset(true)}
            disabled={saving || resetting}
          >
            <Icon name="refresh" size={15} />
            {t('cms.reset')}
          </button>
          <button
            type="submit"
            form="cms-settings-form"
            className="btn btn-primary"
            disabled={saving || resetting}
          >
            {saving ? t('cms.saving') : t('cms.save')}
          </button>
        </div>
      </div>

      <div className="appearance-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'brand'}
          className={`appearance-tab ${activeTab === 'brand' ? 'active' : ''}`}
          onClick={() => setActiveTab('brand')}
        >
          {t('cms.tabBrand')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'colors'}
          className={`appearance-tab ${activeTab === 'colors' ? 'active' : ''}`}
          onClick={() => setActiveTab('colors')}
        >
          {t('cms.tabColors')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'login'}
          className={`appearance-tab ${activeTab === 'login' ? 'active' : ''}`}
          onClick={() => setActiveTab('login')}
        >
          {t('cms.tabLogin')}
        </button>
      </div>

      <form id="cms-settings-form" className="form-stack" onSubmit={handleSubmit}>
        {/* Tab 1: Brand & Logo */}
        {activeTab === 'brand' && (
          <div className="appearance-stack">
            <section className="panel form-stack">
              <h3 className="panel-title">{t('cms.tabBrand')}</h3>
              <p className="panel-desc">{t('cms.brandNameHint')}</p>

              <div className="settings-grid">
                <label className="field">
                  <span>{t('cms.brandName')}</span>
                  <input
                    type="text"
                    value={form.brandName || ''}
                    placeholder="Tên doanh nghiệp / hệ thống"
                    onChange={(e) => updateField('brandName', e.target.value)}
                  />
                  <small className="field-hint">{t('cms.brandNameHint')}</small>
                </label>

                <label className="field">
                  <span>{t('cms.brandSubname')}</span>
                  <input
                    type="text"
                    value={form.brandSubname || ''}
                    placeholder="Admin console"
                    onChange={(e) => updateField('brandSubname', e.target.value)}
                  />
                  <small className="field-hint">{t('cms.brandSubnameHint')}</small>
                </label>
              </div>

              {/* Logo CMS */}
              <div className="field">
                <span>{t('cms.logo')}</span>
                <div className="logo-uploader-card">
                  <div className="logo-preview-box">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="Logo preview" />
                    ) : (
                      <span
                        className="brand-mark"
                        style={{ background: form.colors?.primary || '#0f766e' }}
                      >
                        {form.logoChar || 'O'}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        <Icon name="upload" size={14} />
                        {uploadingLogo ? 'Đang tải…' : t('cms.logoUpload')}
                      </button>
                      {form.logoUrl && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => updateField('logoUrl', '')}
                        >
                          <Icon name="trash" size={14} />
                          {t('cms.logoRemove')}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={form.logoUrl || ''}
                      placeholder="https://example.com/logo.png hoặc /uploads/..."
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                    />
                    <small className="field-hint">{t('cms.logoHint')}</small>
                  </div>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="visually-hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    handleFileUpload(file, 'logo');
                  }}
                />
              </div>

              <div className="settings-grid">
                <label className="field">
                  <span>{t('cms.logoChar')}</span>
                  <input
                    type="text"
                    maxLength={2}
                    value={form.logoChar || ''}
                    placeholder="O"
                    onChange={(e) => updateField('logoChar', e.target.value)}
                  />
                  <small className="field-hint">{t('cms.logoCharHint')}</small>
                </label>

                {/* Favicon */}
                <div className="field">
                  <span>{t('cms.favicon')}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={form.favicon || ''}
                      placeholder="/favicon.ico hoặc link ảnh"
                      onChange={(e) => updateField('favicon', e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => faviconInputRef.current?.click()}
                      disabled={uploadingFavicon}
                    >
                      <Icon name="upload" size={14} />
                      {uploadingFavicon ? '…' : t('cms.faviconUpload')}
                    </button>
                  </div>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/x-icon,image/svg+xml"
                    className="visually-hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      handleFileUpload(file, 'favicon');
                    }}
                  />
                  <small className="field-hint">{t('cms.faviconHint')}</small>
                </div>
              </div>

              <label className="field">
                <span>{t('cms.footerText')}</span>
                <input
                  type="text"
                  value={form.footerText || ''}
                  placeholder="© 2026 Tên Doanh Nghiệp. All rights reserved."
                  onChange={(e) => updateField('footerText', e.target.value)}
                />
                <small className="field-hint">{t('cms.footerTextHint')}</small>
              </label>
            </section>
          </div>
        )}

        {/* Tab 2: Colors */}
        {activeTab === 'colors' && (
          <div className="appearance-stack">
            <section className="panel form-stack">
              <h3 className="panel-title">{t('cms.presets')}</h3>
              <p className="panel-desc">
                Chọn nhanh bảng màu doanh nghiệp được phối sẵn chuẩn nhận diện thương hiệu.
              </p>
              <div className="preset-palette-list">
                {PRESET_PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    className="preset-palette-btn"
                    onClick={() => applyPalette(palette)}
                  >
                    <span
                      className="preset-swatch"
                      style={{ background: palette.primary }}
                    />
                    <span>{palette.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="panel form-stack">
              <h3 className="panel-title">{t('cms.tabColors')}</h3>
              <p className="panel-desc">Tùy biến các mã màu giao diện thanh điều hướng, nút bấm và điểm nhấn.</p>

              <div className="settings-grid">
                <div className="field">
                  <span>{t('cms.primaryColor')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.primary || '#0f766e'}
                      onChange={(e) => updateColor('primary', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.primary || ''}
                      placeholder="#0f766e"
                      onChange={(e) => updateColor('primary', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.primaryDarkColor')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.primaryDark || '#115e59'}
                      onChange={(e) => updateColor('primaryDark', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.primaryDark || ''}
                      placeholder="#115e59"
                      onChange={(e) => updateColor('primaryDark', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.accentDarkColor')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.accentDark || '#2dd4bf'}
                      onChange={(e) => updateColor('accentDark', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.accentDark || ''}
                      placeholder="#2dd4bf"
                      onChange={(e) => updateColor('accentDark', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.sidebarBg')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.sidebarBg || '#ffffff'}
                      onChange={(e) => updateColor('sidebarBg', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.sidebarBg || ''}
                      placeholder="#ffffff"
                      onChange={(e) => updateColor('sidebarBg', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.sidebarText')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.sidebarText || '#0f172a'}
                      onChange={(e) => updateColor('sidebarText', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.sidebarText || ''}
                      placeholder="#0f172a"
                      onChange={(e) => updateColor('sidebarText', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.topbarBg')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.topbarBg || '#ffffff'}
                      onChange={(e) => updateColor('topbarBg', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.topbarBg || ''}
                      placeholder="#ffffff"
                      onChange={(e) => updateColor('topbarBg', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.topbarText')}</span>
                  <div className="color-picker-row">
                    <input
                      type="color"
                      className="color-input-bubble"
                      value={form.colors?.topbarText || '#0f172a'}
                      onChange={(e) => updateColor('topbarText', e.target.value)}
                    />
                    <input
                      type="text"
                      value={form.colors?.topbarText || ''}
                      placeholder="#0f172a"
                      onChange={(e) => updateColor('topbarText', e.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <span>{t('cms.loginPanelBg')}</span>
                  <div className="color-input-row">
                    <input
                      type="color"
                      className="color-swatch"
                      value={toColorValue(currentLoginPanelBg)}
                      aria-label={t('cms.loginPanelBg')}
                      onChange={(e) => updateLoginPanelBg(e.target.value)}
                    />
                    <input
                      type="text"
                      className="color-hex"
                      value={currentLoginPanelBg}
                      placeholder="linear-gradient(150deg, #134e4a 0%, #115e59 48%, #0891b2 100%)"
                      aria-label={t('cms.loginPanelBg')}
                      spellCheck={false}
                      onChange={(e) => updateLoginPanelBg(e.target.value)}
                    />
                    {currentLoginPanelBg ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => updateLoginPanelBg('')}
                      >
                        {t('cms.loginPanelBgDefault')}
                      </button>
                    ) : null}
                  </div>
                  <small className="field-hint">{t('cms.loginPanelBgHint')}</small>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 3: Login Screen */}
        {activeTab === 'login' && (
          <div className="appearance-stack">
            <section className="panel form-stack">
              <h3 className="panel-title">{t('cms.tabLogin')}</h3>
              <p className="panel-desc">
                Tùy chỉnh thông điệp và nội dung hiển thị trên trang đăng nhập dành cho quản trị viên.
              </p>

              <div className="settings-grid">
                <label className="field">
                  <span>{t('cms.loginCardTitle')}</span>
                  <input
                    type="text"
                    value={form.loginTitle || ''}
                    placeholder="Sign in / Đăng nhập"
                    onChange={(e) => updateField('loginTitle', e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{t('cms.loginCardSubtitle')}</span>
                  <input
                    type="text"
                    value={form.loginSubtitle || ''}
                    placeholder="Vui lòng đăng nhập với tài khoản quản trị."
                    onChange={(e) => updateField('loginSubtitle', e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{t('cms.loginWelcome')}</span>
                  <input
                    type="text"
                    value={form.loginWelcome || ''}
                    placeholder="Quản trị hệ thống doanh nghiệp"
                    onChange={(e) => updateField('loginWelcome', e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>{t('cms.loginDescription')}</span>
                  <input
                    type="text"
                    value={form.loginDescription || ''}
                    placeholder="Hệ thống quản lý nội dung và tài liệu tập trung."
                    onChange={(e) => updateField('loginDescription', e.target.value)}
                  />
                </label>
              </div>
            </section>

            <section className="panel form-stack">
              <h3 className="panel-title">{t('cms.loginPanelBg')}</h3>
              <p className="panel-desc">{t('cms.loginPanelBgHint')}</p>

              <div className="field">
                <span>{t('cms.loginPanelBg')}</span>
                <div className="color-input-row">
                  <input
                    type="color"
                    className="color-swatch"
                    value={toColorValue(currentLoginPanelBg)}
                    aria-label={t('cms.loginPanelBg')}
                    onChange={(e) => updateLoginPanelBg(e.target.value)}
                  />
                  <input
                    type="text"
                    className="color-hex"
                    value={currentLoginPanelBg}
                    placeholder="linear-gradient(150deg, #134e4a 0%, #115e59 48%, #0891b2 100%)"
                    aria-label={t('cms.loginPanelBg')}
                    spellCheck={false}
                    onChange={(e) => updateLoginPanelBg(e.target.value)}
                  />
                  {currentLoginPanelBg ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => updateLoginPanelBg('')}
                    >
                      {t('cms.loginPanelBgDefault')}
                    </button>
                  ) : null}
                </div>
                <small className="field-hint">{t('cms.loginPanelBgHint')}</small>
              </div>

              <div>
                <span className="field-hint" style={{ fontWeight: 500, display: 'block', marginBottom: 6 }}>
                  {t('cms.loginPanelPresets')}
                </span>
                <div className="login-panel-presets">
                  {LOGIN_PANEL_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className={`login-panel-preset-btn ${currentLoginPanelBg === preset.value ? 'active' : ''}`}
                      onClick={() => updateLoginPanelBg(preset.value)}
                    >
                      <span
                        className="login-panel-preset-swatch"
                        style={{ background: preset.value }}
                      />
                      <span>{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Live Preview Card */}
        {activeTab === 'login' ? (
          <section className="panel form-stack">
            <h3 className="panel-title">{t('cms.previewLogin')}</h3>
            <p className="panel-desc">{t('cms.previewLoginDesc')}</p>

            <div className="login-panel-preview">
              <div
                className="preview-login-banner"
                style={{
                  background:
                    currentLoginPanelBg ||
                    'linear-gradient(150deg, #134e4a 0%, #115e59 48%, #0891b2 100%)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Logo"
                      style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 6 }}
                    />
                  ) : (
                    <span
                      className="brand-mark"
                      style={{
                        width: 28,
                        height: 28,
                        fontSize: 14,
                        background: 'rgba(255,255,255,0.2)',
                        color: '#fff',
                      }}
                    >
                      {form.logoChar || 'O'}
                    </span>
                  )}
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>
                      {form.brandName || 'WebDoc Demo'}
                    </strong>
                    <small style={{ fontSize: 11, opacity: 0.8 }}>
                      {form.brandSubname || 'Admin console'}
                    </small>
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: 15, margin: '0 0 6px 0', fontWeight: 600 }}>
                    {form.loginWelcome || 'Run your website with confidence'}
                  </h4>
                  <p style={{ fontSize: 12, opacity: 0.85, margin: 0, lineHeight: 1.4 }}>
                    {form.loginDescription ||
                      'Manage the content tree, homepage HTML and site settings in a single interface.'}
                  </p>
                </div>

                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {form.footerText || '© 2026 WebDoc CMS'}
                </div>
              </div>

              <div className="preview-login-card">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <strong style={{ fontSize: 14 }}>
                    {form.loginTitle || 'Sign in'}
                  </strong>
                  <small style={{ opacity: 0.7, fontSize: 12 }}>
                    {form.loginSubtitle || 'Please sign in with an administrator account.'}
                  </small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <div
                    style={{
                      height: 30,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    admin
                  </div>
                  <div
                    style={{
                      height: 30,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '0 8px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 11,
                      color: 'var(--muted)',
                    }}
                  >
                    ••••••••
                  </div>
                  <div
                    style={{
                      height: 30,
                      background: primaryColor,
                      color: '#fff',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {form.loginTitle || 'Sign in'}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="panel form-stack">
            <h3 className="panel-title">{t('cms.preview')}</h3>
            <p className="panel-desc">{t('cms.previewDesc')}</p>

            <div className="cms-live-preview">
              <div
                className="preview-sidebar"
                style={{
                  background: form.colors?.sidebarBg || '#ffffff',
                  color: form.colors?.sidebarText || '#0f172a',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {form.logoUrl ? (
                    <img
                      src={form.logoUrl}
                      alt="Logo"
                      style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }}
                    />
                  ) : (
                    <span
                      className="brand-mark"
                      style={{
                        width: 32,
                        height: 32,
                        fontSize: 16,
                        background: primaryColor,
                      }}
                    >
                      {form.logoChar || 'O'}
                    </span>
                  )}
                  <div>
                    <strong style={{ fontSize: 13, display: 'block' }}>
                      {form.brandName || 'Doanh Nghiệp'}
                    </strong>
                    <small style={{ fontSize: 11, opacity: 0.65 }}>
                      {form.brandSubname || 'Admin console'}
                    </small>
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: form.colors?.primary ? `${form.colors.primary}18` : '#ecfdf5',
                    color: primaryColor,
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  ● Trang mẫu
                </div>
              </div>

              <div
                className="preview-topbar"
                style={{
                  background: form.colors?.topbarBg || '#ffffff',
                  color: form.colors?.topbarText || '#0f172a',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ fontSize: 14 }}>{t('cms.title')}</strong>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{
                      background: primaryColor,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 12,
                    }}
                  >
                    Nút thử nghiệm
                  </button>
                </div>
                <small style={{ opacity: 0.7 }}>
                  Giao diện hiển thị trực quan các màu sắc và logo đã chọn.
                </small>
              </div>
            </div>
          </section>
        )}
      </form>

      {confirmReset && (
        <ConfirmDialog
          title={t('cms.reset')}
          message={t('cms.resetConfirm')}
          busy={resetting}
          onCancel={() => setConfirmReset(false)}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
