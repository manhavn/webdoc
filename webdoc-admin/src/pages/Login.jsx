import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import LangSwitch from '../components/LangSwitch';
import ThemeSwitch from '../components/ThemeSwitch';

export default function Login() {
  const { user, loading, login } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = location.state?.from || '/';

  useEffect(() => {
    document.title = `${t('login.cardTitle')} — ${t('brand.name')}`;
  }, [lang, t]);

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

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark brand-mark-lg">O</span>
          <div>
            <strong>{t('brand.name')}</strong>
            <small>{t('login.brandSub')}</small>
          </div>
        </div>

        <div className="login-copy">
          <h1>{t('login.heading')}</h1>
          <p>{t('login.description')}</p>
          <ul>
            <li>
              <Icon name="docs" size={18} /> {t('login.featureTree')}
            </li>
            <li>
              <Icon name="layout" size={18} /> {t('login.featureLayout')}
            </li>
          </ul>
        </div>

        <p className="login-footnote">{t('login.footnote')}</p>
      </div>

      <div className="login-form-wrap">
        <div className="login-controls">
          <ThemeSwitch />
          <LangSwitch />
        </div>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-card-head">
            <h2>{t('login.cardTitle')}</h2>
            <p>{t('login.cardSubtitle')}</p>
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
