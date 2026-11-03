import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import Icon from '../components/Icons';
import Modal from '../components/Modal';
import {
  readStoredAutosaveInterval,
  writeStoredAutosaveInterval,
  getNextAutosaveInterval,
} from '../lib/autosave';

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
  const [autosaveInterval, setAutosaveInterval] = useState(() => readStoredAutosaveInterval());
  const [autosaving, setAutosaving] = useState(false);
  const autosaveIntervalRef = useRef(autosaveInterval);
  autosaveIntervalRef.current = autosaveInterval;
  const autosaveTimerRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const autosavingRef = useRef(autosaving);
  autosavingRef.current = autosaving;

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
    const initial = { ...home };
    setDraft(initial);
    setEditing(true);
    const stored = readStoredAutosaveInterval();
    setAutosaveInterval(stored);
    autosaveIntervalRef.current = stored;
    lastSavedSnapshotRef.current = initial.content || '';
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }

  function closeEditor() {
    if (saving || autosaving) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    setEditing(false);
    setAutosaving(false);
  }

  const scheduleAutosaveRetry = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (!editingRef.current || autosaveIntervalRef.current === -1) {
      return;
    }
    const intervalSec = autosaveIntervalRef.current > 0 ? autosaveIntervalRef.current : 30;
    autosaveTimerRef.current = setTimeout(() => {
      runAutosave();
    }, intervalSec * 1000);
  }, []);

  const runAutosave = useCallback(async () => {
    autosaveTimerRef.current = null;
    if (!editingRef.current || autosaveIntervalRef.current === -1) {
      return;
    }
    if (savingRef.current || autosavingRef.current) {
      scheduleAutosaveRetry();
      return;
    }
    const currentContent = draftRef.current.content || '';
    if (currentContent === lastSavedSnapshotRef.current) {
      return;
    }
    if (!appearanceRef.current) {
      scheduleAutosaveRetry();
      return;
    }

    const next = {
      ...draftRef.current,
      slug: 'home',
      title: draftRef.current.title || 'Homepage',
      content: currentContent,
    };

    setAutosaving(true);
    autosavingRef.current = true;
    try {
      const saved = await api.updateAppearance({ ...appearanceRef.current, pages: [next] });
      setAppearance(saved);
      appearanceRef.current = saved;
      setHome(normalizeHome((saved?.pages || []).find((page) => page.slug === 'home') || next));
      lastSavedSnapshotRef.current = currentContent;
      toast.success(t('docs.autosaved'));
      setAutosaving(false);
      autosavingRef.current = false;

      if (
        editingRef.current &&
        autosaveIntervalRef.current !== -1 &&
        (draftRef.current.content || '') !== lastSavedSnapshotRef.current
      ) {
        autosaveTimerRef.current = setTimeout(runAutosave, autosaveIntervalRef.current * 1000);
      }
    } catch (err) {
      setAutosaving(false);
      autosavingRef.current = false;
      console.warn('Homepage autosave error, will retry:', err);
      scheduleAutosaveRetry();
    }
  }, [scheduleAutosaveRetry, t, toast]);

  useEffect(() => {
    if (!editing) return;
    const isChanged = (draft.content || '') !== lastSavedSnapshotRef.current;
    if (
      isChanged &&
      autosaveIntervalRef.current !== -1 &&
      !autosaveTimerRef.current &&
      !saving &&
      !autosaving
    ) {
      const intervalSec = autosaveIntervalRef.current > 0 ? autosaveIntervalRef.current : 30;
      autosaveTimerRef.current = setTimeout(runAutosave, intervalSec * 1000);
    }
  }, [draft.content, editing, saving, autosaving, runAutosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, []);

  function handleCycleAutosave() {
    const next = getNextAutosaveInterval(autosaveInterval);
    setAutosaveInterval(next);
    autosaveIntervalRef.current = next;
    writeStoredAutosaveInterval(next);

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (next === -1) {
      toast.info(t('docs.autosaveOffNotice'));
    } else {
      toast.info(t('docs.autosaveIntervalNotice', { s: next }));
      if ((draftRef.current.content || '') !== lastSavedSnapshotRef.current) {
        autosaveTimerRef.current = setTimeout(runAutosave, next * 1000);
      }
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!appearance || saving || autosaving) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
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
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleCycleAutosave}
                disabled={saving}
                title={t('docs.autosaveTooltip')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: autosaveInterval === -1 ? 'var(--muted)' : 'var(--accent)',
                  border: '1px solid var(--border)',
                  background: autosaveInterval === -1 ? 'transparent' : 'var(--accent-soft)',
                  fontWeight: 500,
                  fontSize: 13,
                  padding: '6px 12px',
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor:
                      autosaveInterval === -1
                        ? 'var(--muted)'
                        : autosaving
                          ? '#f59e0b'
                          : 'var(--accent)',
                    display: 'inline-block',
                  }}
                />
                <span>
                  {autosaving
                    ? t('docs.autosaving')
                    : autosaveInterval === -1
                      ? t('docs.autosaveOff')
                      : t('docs.autosaveOn', { s: autosaveInterval })}
                </span>
              </button>
              <button type="button" className="btn btn-ghost" onClick={closeEditor} disabled={saving || autosaving}>
                {t('common.cancel')}
              </button>
              <button type="submit" form="homepage-editor" className="btn btn-primary" disabled={saving || autosaving}>
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
