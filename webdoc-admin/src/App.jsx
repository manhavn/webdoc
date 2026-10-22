import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { useI18n } from './i18n/I18nContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Docs from './pages/Docs';
import Backup from './pages/Backup';
import SiteSettings from './pages/SiteSettings';
import Appearance from './pages/Appearance';
import Homepage from './pages/Homepage';
import Languages from './pages/Languages';

function LoadingScreen() {
  const { t } = useI18n();
  return (
    <div className="app-loading">
      <span className="spinner" aria-hidden="true" />
      <p>{t('common.loading')}</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="docs" element={<Docs />} />
        <Route path="backup" element={<Backup />} />
        <Route path="site" element={<SiteSettings />} />
        <Route path="appearance" element={<Appearance />} />
        <Route path="homepage" element={<Homepage />} />
        <Route path="languages" element={<Languages />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
