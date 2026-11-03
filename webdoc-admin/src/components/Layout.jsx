import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n/I18nContext';
import { useCms } from '../context/CmsContext';
import Icon from './Icons';
import LangSwitch from './LangSwitch';
import ThemeSwitch from './ThemeSwitch';
import ChangePasswordDialog from './ChangePasswordDialog';
import { useToast } from './Toast';
import { getToken } from '../lib/api';
import { getTokenExp, formatTokenRemaining } from '../lib/tokenExpiry';

const NAV_ITEMS = [
  { labelKey: 'nav.dashboard', to: '/', icon: 'dashboard', end: true },
  { labelKey: 'nav.docs', to: '/docs', icon: 'docs' },
  { labelKey: 'nav.site', to: '/site', icon: 'settings' },
  { labelKey: 'nav.appearance', to: '/appearance', icon: 'appearance' },
  { labelKey: 'nav.cmsSettings', to: '/cms-settings', icon: 'settings' },
  { labelKey: 'nav.homepage', to: '/homepage', icon: 'dashboard' },
  { labelKey: 'nav.languages', to: '/languages', icon: 'globe' },
  { labelKey: 'nav.backup', to: '/backup', icon: 'backup' },
  { labelKey: 'nav.users', to: '/users', icon: 'user', adminOnly: true },
];

const PAGE_TITLES = {
  '/': 'nav.dashboard',
  '/docs': 'nav.docs',
  '/site': 'nav.site',
  '/appearance': 'nav.appearance',
  '/cms-settings': 'nav.cmsSettings',
  '/homepage': 'nav.homepage',
  '/languages': 'nav.languages',
  '/backup': 'nav.backup',
  '/users': 'nav.users',
};

function pageTitleKey(pathname) {
  return PAGE_TITLES[pathname] || 'nav.adminTitle';
}

export default function Layout() {
  const { user, logout, refreshToken } = useAuth();
  const toast = useToast();
  const { t, lang } = useI18n();
  const { cms } = useCms();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const userMenuRef = useRef(null);
  const [remainingSeconds, setRemainingSeconds] = useState(() => {
    const token = getToken();
    const exp = getTokenExp(token);
    return exp ? exp - Math.floor(Date.now() / 1000) : null;
  });
  const [refreshingToken, setRefreshingToken] = useState(false);
  const hasNotifiedExpiry = useRef(false);
  const titleKey = pageTitleKey(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
    document.title = `${t(titleKey)} — ${cms.brandName || t('brand.name')}`;
  }, [location.pathname, lang, t, titleKey]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    const tick = () => {
      const token = getToken();
      const exp = getTokenExp(token);
      if (!exp) {
        setRemainingSeconds(null);
        return;
      }
      const diff = exp - Math.floor(Date.now() / 1000);
      setRemainingSeconds(diff);
      if (diff <= 0) {
        if (!hasNotifiedExpiry.current) {
          hasNotifiedExpiry.current = true;
          toast.error(
            t('nav.tokenExpiredToast') ||
              'Phiên đăng nhập đã hết hạn! Bạn cần copy những thứ đang làm vào nơi khác để tránh mất dữ liệu và đăng nhập lại.'
          );
        }
      } else {
        hasNotifiedExpiry.current = false;
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [t, toast]);

  async function handleRefreshToken() {
    setRefreshingToken(true);
    try {
      await refreshToken();
      hasNotifiedExpiry.current = false;
      const token = getToken();
      const exp = getTokenExp(token);
      if (exp) {
        setRemainingSeconds(exp - Math.floor(Date.now() / 1000));
      }
      toast.success(t('nav.refreshTokenSuccess'));
    } catch (err) {
      toast.error(err.message || t('nav.refreshTokenError'));
    } finally {
      setRefreshingToken(false);
    }
  }

  const expiryInfo = formatTokenRemaining(remainingSeconds, t);
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly) return user?.role === 'admin';
    if (user?.role === 'admin') return true;
    const allowed = Array.isArray(user?.allowedRoutes)
      ? user.allowedRoutes
      : ['/', '/docs', '/cms-settings'];
    const path = item.to.replace(/^\/admin/, '') || '/';
    return (
      allowed.includes(path) ||
      allowed.includes(item.to) ||
      allowed.includes(`/admin${path}`) ||
      (path === '/' && (allowed.includes('/admin') || allowed.includes('/')))
    );
  });

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  }

  const username = user?.username || 'admin';
  const initial = username.charAt(0).toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="brand">
          {cms.logoUrl ? (
            <img
              src={cms.logoUrl}
              alt={cms.brandName || t('brand.name')}
              className="brand-logo-img"
            />
          ) : (
            <span className="brand-mark">{cms.logoChar || 'O'}</span>
          )}
          <span className="brand-text">
            <strong>{cms.brandName || t('brand.name')}</strong>
            <small>{cms.brandSubname || t('brand.admin')}</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label={t('nav.adminNav')}>
          <span className="nav-caption">{t('nav.caption')}</span>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{t(item.labelKey)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <a className="nav-link" href="/" target="_blank" rel="noreferrer">
            <Icon name="external" />
            <span>{t('nav.viewSite')}</span>
          </a>
          <button type="button" className="nav-link nav-button" onClick={handleLogout}>
            <Icon name="logout" />
            <span>{t('nav.logout')}</span>
          </button>
          <p className="sidebar-note">{cms.footerText || `${cms.brandName || t('brand.name')} v1.0.1`}</p>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
      )}

      <div className="main-area">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={t('nav.openMenu')}
          >
            <Icon name={sidebarOpen ? 'close' : 'menu'} size={20} />
          </button>

          <div className="topbar-title">
            <h1>{t(titleKey)}</h1>
            <p>{t('nav.subtitle')}</p>
          </div>

          <div className="topbar-actions">
            <ThemeSwitch />
            <LangSwitch />
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="user-button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="avatar">{initial}</span>
                <span className="user-meta">
                  <strong>{username}</strong>
                  <small>
                    {user?.role === 'admin' || !user?.role ? t('nav.roleAdmin') : user.role}
                  </small>
                </span>
                <Icon name="down" size={16} />
              </button>

              {menuOpen && (
                <div className="user-dropdown" role="menu" style={{ minWidth: 230 }}>
                  <div
                    className="token-expiry-card"
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid var(--border)',
                      background: expiryInfo.expired ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-soft)',
                      borderRadius: '8px 8px 4px 4px',
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: expiryInfo.expired ? 'var(--error, #ef4444)' : 'var(--muted)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: 0.3,
                        }}
                      >
                        {t('nav.tokenExpiryTitle')}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: expiryInfo.expired
                            ? 'var(--error, #ef4444)'
                            : remainingSeconds !== null && remainingSeconds < 60
                              ? 'var(--error, #ef4444)'
                              : 'var(--accent)',
                        }}
                      >
                        {expiryInfo.text}
                      </span>
                    </div>

                    {expiryInfo.expired && (
                      <p
                        style={{
                          margin: '6px 0 8px',
                          fontSize: 11,
                          color: 'var(--error, #ef4444)',
                          lineHeight: 1.4,
                        }}
                      >
                        {expiryInfo.warning}
                      </p>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleRefreshToken}
                      disabled={refreshingToken}
                      style={{
                        width: '100%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: 12,
                        padding: '5px 8px',
                        marginTop: 6,
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--panel)',
                        cursor: refreshingToken ? 'wait' : 'pointer',
                      }}
                    >
                      <Icon name="refresh" size={13} className={refreshingToken ? 'spin' : ''} />
                      {refreshingToken ? t('nav.refreshingToken') : t('nav.refreshTokenBtn')}
                    </button>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowPassword(true);
                    }}
                  >
                    <Icon name="lock" size={16} />
                    {t('nav.changePassword')}
                  </button>
                  <button type="button" role="menuitem" onClick={handleLogout}>
                    <Icon name="logout" size={16} />
                    {t('nav.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {showPassword && <ChangePasswordDialog onClose={() => setShowPassword(false)} />}
    </div>
  );
}
