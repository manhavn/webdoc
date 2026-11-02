import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { DEFAULT_CMS_SETTINGS } from '../lib/cmsDefaults.js';

export { DEFAULT_CMS_SETTINGS };
const CMS_STORAGE_KEY = 'webdoc_cms_settings';


function hexToRgba(hex, alpha) {
  if (!hex || typeof hex !== 'string') return '';
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return '';
}

function initialSettings() {
  try {
    const cached = localStorage.getItem(CMS_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const loginBg = parsed.loginPanelBg || parsed.colors?.loginPanelBg || '';
      return {
        ...DEFAULT_CMS_SETTINGS,
        ...parsed,
        loginPanelBg: loginBg,
        colors: {
          ...DEFAULT_CMS_SETTINGS.colors,
          ...(parsed.colors || {}),
          loginPanelBg: loginBg,
        },
      };
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_CMS_SETTINGS;
}

const CmsContext = createContext(null);

export function CmsProvider({ children }) {
  const [cms, setCmsState] = useState(initialSettings);
  const [loading, setLoading] = useState(true);

  const applyColors = useCallback((data) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const colors = data?.colors || DEFAULT_CMS_SETTINGS.colors;

    if (colors.primary) {
      root.style.setProperty('--cms-primary', colors.primary);
      root.style.setProperty('--cms-primary-dark', colors.primaryDark || colors.primary);
      root.style.setProperty(
        '--cms-primary-soft',
        hexToRgba(colors.primary, 0.12) || '#ecfdf5',
      );
      root.style.setProperty(
        '--cms-primary-border',
        hexToRgba(colors.primary, 0.3) || '#99f6e4',
      );
    }
    if (colors.accentDark) {
      root.style.setProperty('--cms-accent-dark', colors.accentDark);
    }
    if (colors.sidebarBg) {
      root.style.setProperty('--cms-sidebar-bg', colors.sidebarBg);
    }
    if (colors.sidebarText) {
      root.style.setProperty('--cms-sidebar-text', colors.sidebarText);
    }
    if (colors.topbarBg) {
      root.style.setProperty('--cms-topbar-bg', colors.topbarBg);
    }
    if (colors.topbarText) {
      root.style.setProperty('--cms-topbar-text', colors.topbarText);
    }
    const loginPanelBg = colors.loginPanelBg || data?.loginPanelBg;
    if (loginPanelBg) {
      root.style.setProperty('--cms-login-panel-bg', loginPanelBg);
    } else {
      root.style.removeProperty('--cms-login-panel-bg');
    }

    if (data?.favicon) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = data.favicon;
    }
  }, []);

  const refreshCms = useCallback(async () => {
    try {
      const data = await api.getPublicCms();
      if (data && typeof data === 'object') {
        const loginBg = data.loginPanelBg || data.colors?.loginPanelBg || '';
        const merged = {
          ...DEFAULT_CMS_SETTINGS,
          ...data,
          loginPanelBg: loginBg,
          colors: {
            ...DEFAULT_CMS_SETTINGS.colors,
            ...(data.colors || {}),
            loginPanelBg: loginBg,
          },
        };
        setCmsState(merged);
        applyColors(merged);
        try {
          localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(merged));
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore fetch error; use defaults or cached */
    } finally {
      setLoading(false);
    }
  }, [applyColors]);

  useEffect(() => {
    applyColors(cms);
    refreshCms();
  }, [applyColors, refreshCms]);

  const updateCms = useCallback(
    async (payload) => {
      const updated = await api.updateCms(payload);
      const loginBg =
        updated.loginPanelBg ||
        updated.colors?.loginPanelBg ||
        payload?.loginPanelBg ||
        payload?.colors?.loginPanelBg ||
        '';
      const merged = {
        ...DEFAULT_CMS_SETTINGS,
        ...updated,
        loginPanelBg: loginBg,
        colors: {
          ...DEFAULT_CMS_SETTINGS.colors,
          ...(updated.colors || {}),
          loginPanelBg: loginBg,
        },
      };
      setCmsState(merged);
      applyColors(merged);
      try {
        localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    },
    [applyColors],
  );

  const resetCms = useCallback(async () => {
    const res = await api.resetCms();
    const loginBg = res.loginPanelBg || res.colors?.loginPanelBg || '';
    const merged = {
      ...DEFAULT_CMS_SETTINGS,
      ...res,
      loginPanelBg: loginBg,
      colors: {
        ...DEFAULT_CMS_SETTINGS.colors,
        ...(res.colors || {}),
        loginPanelBg: loginBg,
      },
    };
    setCmsState(merged);
    applyColors(merged);
    try {
      localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(merged));
    } catch {
      /* ignore */
    }
    return merged;
  }, [applyColors]);

  const value = useMemo(
    () => ({
      cms,
      loading,
      updateCms,
      resetCms,
      refreshCms,
    }),
    [cms, loading, updateCms, resetCms, refreshCms],
  );

  return <CmsContext.Provider value={value}>{children}</CmsContext.Provider>;
}

export function useCms() {
  const context = useContext(CmsContext);
  if (!context) {
    return {
      cms: DEFAULT_CMS_SETTINGS,
      loading: false,
      updateCms: async () => {},
      resetCms: async () => {},
      refreshCms: async () => {},
    };
  }
  return context;
}
