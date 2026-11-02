import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n/I18nContext';
import { useCms } from '../context/CmsContext';
import Icon from '../components/Icons';
import LangSwitch from '../components/LangSwitch';
import ThemeSwitch from '../components/ThemeSwitch';

export default function Login() {
  const { user, loading, login } = useAuth();
  const { t, lang } = useI18n();
  const { cms } = useCms();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || '/';

  useEffect(() => {
    document.title = `${cms.loginTitle || t('login.cardTitle')} — ${cms.brandName || t('brand.name')}`;
  }, [lang, t, cms.loginTitle, cms.brandName]);

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.message || t('login.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const loginPanelBg = cms?.colors?.loginPanelBg || cms?.loginPanelBg;

  return (
    <div className="login-page">
      <div
        className="login-panel"
        style={loginPanelBg ? { background: loginPanelBg } : undefined}
      >
        <div className="login-brand">
          {cms.logoUrl ? (
            <img
              src={cms.logoUrl}
              alt={cms.brandName || t('brand.name')}
              className="brand-logo-img-lg"
            />
          ) : (
            <span className="brand-mark brand-mark-lg">{cms.logoChar || 'O'}</span>
          )}
          <div>
            <strong>{cms.brandName || t('brand.name')}</strong>
            <small>{cms.brandSubname || t('login.brandSub')}</small>
          </div>
        </div>

        <div className="login-copy">
          <h1>{cms.loginWelcome || t('login.heading')}</h1>
          <p>{cms.loginDescription || t('login.description')}</p>
          <ul>
            <li>
              <Icon name="docs" size={18} /> {t('login.featureTree')}
            </li>
            <li>
              <Icon name="layout" size={18} /> {t('login.featureLayout')}
            </li>
          </ul>
        </div>

        <p className="login-footnote">{cms.footerText || t('login.footnote')}</p>
      </div>

      <div className="login-form-wrap">
        <div className="login-controls">
          <ThemeSwitch />
          <LangSwitch />
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <h2>{cms.loginTitle || t('login.cardTitle')}</h2>
            <p>{cms.loginSubtitle || t('login.cardSubtitle')}</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <label className="field">
            <span>{t('login.username')}</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              placeholder={t('login.username')}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span>{t('login.password')}</span>
            <div className="input-with-action">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder={t('login.password')}
                required
              />
              <button
                type="button"
                className="input-action"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
              >
                <Icon name="eye" size={17} />
              </button>
            </div>
          </label>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? t('login.submitting') : t('login.submit')}
          </button>

          <p className="login-hint">
            {t('login.hintBefore')} <code>.env</code> {t('login.hintAfter')}
          </p>
        </form>
      </div>
    </div>
  );
}
