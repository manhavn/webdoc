import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../i18n/I18nContext';
import Icon from './Icons';
import LangSwitch from './LangSwitch';
import ThemeSwitch from './ThemeSwitch';
import ChangePasswordDialog from './ChangePasswordDialog';

const NAV_ITEMS = [
  { labelKey: 'nav.dashboard', to: '/', icon: 'dashboard', end: true },
  { labelKey: 'nav.docs', to: '/docs', icon: 'docs' },
  { labelKey: 'nav.site', to: '/site', icon: 'settings' },
  { labelKey: 'nav.appearance', to: '/appearance', icon: 'appearance' },
  { labelKey: 'nav.homepage', to: '/homepage', icon: 'dashboard' },
  { labelKey: 'nav.languages', to: '/languages', icon: 'globe' },
  { labelKey: 'nav.backup', to: '/backup', icon: 'backup' },
];

const PAGE_TITLES = {
  '/': 'nav.dashboard',
  '/docs': 'nav.docs',
  '/site': 'nav.site',
  '/appearance': 'nav.appearance',
  '/homepage': 'nav.homepage',
  '/languages': 'nav.languages',
  '/backup': 'nav.backup',
};

function pageTitleKey(pathname) {
  return PAGE_TITLES[pathname] || 'nav.adminTitle';
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, lang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const userMenuRef = useRef(null);
  const titleKey = pageTitleKey(location.pathname);

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
    document.title = `${t(titleKey)} — ${t('brand.name')}`;
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
          <span className="brand-mark">O</span>
          <span className="brand-text">
            <strong>{t('brand.name')}</strong>
            <small>{t('brand.admin')}</small>
          </span>
        </div>

        <nav className="sidebar-nav" aria-label={t('nav.adminNav')}>
          <span className="nav-caption">{t('nav.caption')}</span>
          {NAV_ITEMS.map((item) => (
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
          <p className="sidebar-note">{t('brand.name')} v1.0.0</p>
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
                <div className="user-dropdown" role="menu">
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
