import { useRef, useState } from 'react';
import { api, exportBackup } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';

export default function Backup() {
  const { t } = useI18n();
  const toast = useToast();
  const { logout } = useAuth();
  const fileRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const { blob, filename } = await exportBackup();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success(t('backup.exported'));
    } catch (err) {
      setError(err.message || t('backup.exportError'));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!file || !confirmed) return;
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const data = await api.importBackup(file);
      setResult(data);
      setFile(null);
      setConfirmed(false);
      if (fileRef.current) fileRef.current.value = '';
      toast.success(t('backup.imported'));
    } catch (err) {
      setError(err.message || t('backup.importError'));
    } finally {
      setImporting(false);
    }
  }

  const collections = result?.collections || {};

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('backup.title')}</h2>
          <p>{t('backup.subtitle')}</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="settings-grid">
        <section className="panel form-stack">
          <h3 className="panel-title">{t('backup.exportTitle')}</h3>
          <p className="panel-desc">{t('backup.exportDesc')}</p>
          <ul className="backup-list">
            <li>{t('backup.exportItem1')}</li>
            <li>{t('backup.exportItem2')}</li>
            <li>{t('backup.exportItem3')}</li>
          </ul>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleExport}
              disabled={exporting}
            >
              <Icon name="backup" size={16} />
              {exporting ? t('backup.exporting') : t('backup.exportButton')}
            </button>
          </div>
        </section>

        <section className="panel form-stack">
          <h3 className="panel-title">{t('backup.importTitle')}</h3>
          <p className="panel-desc">
            {t('backup.importDescBefore')}{' '}
            <strong>{t('backup.importDescStrong')}</strong>{' '}
            {t('backup.importDescAfter')}
          </p>
          <label className="field">
            <span>{t('backup.fileLabel')}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            {t('backup.confirmCheck')}
          </label>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleImport}
              disabled={!file || !confirmed || importing}
            >
              <Icon name="backup" size={16} />
              {importing ? t('backup.importing') : t('backup.importButton')}
            </button>
          </div>
        </section>
      </div>

      {result && (
        <section className="panel form-stack">
          <h3 className="panel-title">{t('backup.resultTitle')}</h3>
          <p className="panel-desc">
            {t('backup.resultDesc', {
              collections: Object.keys(collections).length,
              uploads: result.uploads || 0,
            })}
          </p>
          <div className="backup-result-grid">
            {Object.entries(collections).map(([name, count]) => (
              <div className="backup-result" key={name}>
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="page-actions">
            <button type="button" className="btn btn-ghost" onClick={logout}>
              {t('backup.logout')}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
