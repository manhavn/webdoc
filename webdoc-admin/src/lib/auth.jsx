import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken, UNAUTHORIZED_EVENT } from './api';

const AuthContext = createContext(null);

function normalizeUser(data) {
  if (!data) return null;
  if (data.user) return data.user;
  if (data.username || data.role) return data;
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken()));
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.me();
        if (active) {
          setUser(normalizeUser(data));
          setSessionExpired(false);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      setSessionExpired(true);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setToken(data.token);
    setUser(normalizeUser(data.user) || { username, role: 'admin' });
    setSessionExpired(false);
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSessionExpired(false);
  }, []);

  const refreshToken = useCallback(async () => {
    const data = await api.refreshToken();
    setToken(data.token);
    setUser(normalizeUser(data.user) || user);
    setSessionExpired(false);
    return data;
  }, [user]);

  const value = useMemo(
    () => ({ user, loading, sessionExpired, login, logout, refreshToken }),
    [user, loading, sessionExpired, login, logout, refreshToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
