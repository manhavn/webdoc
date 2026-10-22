import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import Icon from '../components/Icons';
import Modal from '../components/Modal';

const EMPTY_HOME = {
  slug: 'home',
  title: 'Homepage',
  titleVi: 'Trang chủ',
  titles: {},
  content: '',
};

function normalizeHome(page) {
  return {
    ...EMPTY_HOME,
    ...page,
    slug: 'home',
    titles: page?.titles && typeof page.titles === 'object' ? page.titles : {},
    content: String(page?.content || ''),
  };
}

export default function Homepage() {
  const { t } = useI18n();
  const toast = useToast();
  const [appearance, setAppearance] = useState(null);
  const [home, setHome] = useState(EMPTY_HOME);
  const [draft, setDraft] = useState(EMPTY_HOME);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAppearance();
      setAppearance(data);
      setHome(normalizeHome((data?.pages || []).find((page) => page.slug === 'home')));
    } catch (err) {
      setError(err.message || t('pages.error'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openEditor() {
    setDraft({ ...home });
    setEditing(true);
  }

  function closeEditor() {
    if (saving) return;
    setEditing(false);
  }

  async function save(event) {
    event.preventDefault();
    if (!appearance) return;
    setSaving(true);
    setError('');
    const next = {
      ...draft,
      slug: 'home',
      title: draft.title || 'Homepage',
      content: draft.content || '',
    };
    try {
      const saved = await api.updateAppearance({ ...appearance, pages: [next] });
      setAppearance(saved);
      setHome(normalizeHome((saved?.pages || []).find((page) => page.slug === 'home') || next));
      setEditing(false);
      toast.success(t('pages.saved'));
    } catch (err) {
      setError(err.message || t('pages.error'));
    } finally {
      setSaving(false);
    }
  }

  async function resetHome() {
    if (!window.confirm(t('pages.resetConfirm'))) return;
    setSaving(true);
    setError('');
    try {
      const saved = await api.resetHomepage();
      setAppearance(saved);
      setHome(normalizeHome((saved?.pages || []).find((page) => page.slug === 'home')));
      toast.success(t('pages.resetDone'));
    } catch (err) {
      setError(err.message || t('pages.error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="page"><div className="empty-state">{t('common.loading')}</div></div>;
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('pages.homeTitle')}</h2>
          <p>{t('pages.homeDesc')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-ghost" onClick={load} disabled={saving}>
            <Icon name="refresh" /> {t('common.reload')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('pages.homeTitle')}</th>
              <th className="align-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>{t('pages.homeTitle')}</strong>
                <div className="cell-sub">{t('pages.homeLocked')}</div>
              </td>
              <td className="align-right">
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={openEditor}>
                    <Icon name="edit" size={14} /> {t('common.edit')}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetHome} disabled={saving}>
                    <Icon name="refresh" size={14} /> {t('pages.resetHome')}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={t('pages.homeTitle')}
          onClose={closeEditor}
          full
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={saving}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="homepage-editor" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <form id="homepage-editor" className="form-stack homepage-editor" onSubmit={save}>
            <div className="alert alert-info">{t('pages.homeDesc')}</div>
            <label className="field">
              <span>{t('pages.homeContent')}</span>
              <textarea
                className="code-textarea"
                rows={24}
                value={draft.content || ''}
                onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                spellCheck={false}
              />
              <small className="field-hint">{t('pages.homeContentHint')}</small>
            </label>
          </form>
        </Modal>
      )}
    </div>
  );
}
