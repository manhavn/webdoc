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

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api.me();
        if (active) setUser(normalizeUser(data));
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
      setToken(null);
      setUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    setToken(data.token);
    setUser(normalizeUser(data.user) || { username, role: 'admin' });
    return data;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
