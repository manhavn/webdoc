import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import Icon from '../components/Icons';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import {
  buildLanguagePayload,
  countVisibleUiLocales,
  normalizeLanguageList,
  resolveUiState,
  runLanguageReset,
  uiDefaultPayload,
  uiVisibilityPayload,
} from '../lib/languageUi';

const EMPTY_FORM = {
  code: '',
  name: '',
  enabled: true,
  isDefault: false,
  uiEnabled: true,
  uiDefault: false,
  order: 0,
  ui: '{}',
  admin: '{}',
};

const CODE_PATTERN = /^[a-z]{2}(-[a-z]{2})?$/i;

function asJson(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '{}';
  return JSON.stringify(value, null, 2);
}

function parseDictionary(text, label, t) {
  let parsed;
  try {
    parsed = String(text ?? '').trim() ? JSON.parse(text) : {};
  } catch {
    return { error: `${label}: ${t('languages.invalidJson')}` };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: `${label}: ${t('languages.invalidJson')}` };
  }
  const invalid = Object.values(parsed).some((value) => typeof value !== 'string');
  if (invalid) {
    return { error: `${label}: ${t('languages.invalidJson')}` };
  }
  return { value: parsed };
}

export default function Languages() {
  const { t, reload } = useI18n();
  const toast = useToast();

  const [items, setItems] = useState([]);
  const [defaultLocale, setDefaultLocale] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState('');

  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);

  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listLanguages();
      const normalized = normalizeLanguageList(data);
      setItems(normalized.items);
      setDefaultLocale(normalized.defaultLocale);
    } catch (err) {
      setError(err.message || t('api.networkError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    const nextOrder =
      items.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0) + 1;
    setForm({ ...EMPTY_FORM, order: nextOrder });
    setFormError('');
    setEditor({ mode: 'create' });
  }

  function openEdit(item) {
    const uiState = resolveUiState(item);
    setForm({
      code: item.code || '',
      name: item.name || '',
      enabled: item.enabled !== false,
      isDefault: Boolean(item.isDefault),
      uiEnabled: uiState.uiEnabled,
      uiDefault: uiState.uiDefault,
      order: item.order ?? 0,
      ui: asJson(item.ui),
      admin: asJson(item.admin),
    });
    setFormError('');
    setEditor({ mode: 'edit', item });
  }

  function closeEditor() {
    if (!saving && !copying) setEditor(null);
  }

  async function handleCopyFromEnglish() {
    setCopying(true);
    setFormError('');
    try {
      let source = items.find((item) => item.code === 'en');
      let ui = source?.ui;
      let admin = source?.admin;
      if (!ui || !admin) {
        const document = await api.getI18nLocale('en');
        ui = document?.ui;
        admin = document?.admin;
      }
      setForm((current) => ({
        ...current,
        ui: asJson(ui),
        admin: asJson(admin),
      }));
    } catch (err) {
      setFormError(err.message || t('api.networkError'));
    } finally {
      setCopying(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setFormError('');

    const code = String(form.code).trim().toLowerCase();
    if (editor.mode === 'create' && !CODE_PATTERN.test(code)) {
      setFormError(`${t('languages.code')}: ${t('languages.codeHint')}`);
      return;
    }
    if (!String(form.name).trim()) {
      setFormError(t('languages.name'));
      return;
    }

    const parsedUi = parseDictionary(form.ui, t('languages.uiMessages'), t);
    if (parsedUi.error) {
      setFormError(parsedUi.error);
      return;
    }
    const parsedAdmin = parseDictionary(form.admin, t('languages.adminMessages'), t);
    if (parsedAdmin.error) {
      setFormError(parsedAdmin.error);
      return;
    }

    const enabled = Boolean(form.enabled);
    const uiEnabled = enabled && Boolean(form.uiEnabled);
    const uiDefault = uiEnabled && Boolean(form.uiDefault);
    if (form.uiDefault && !uiEnabled) {
      setFormError(t('languages.uiDefaultNotVisible'));
      return;
    }
    if (
      editor.mode === 'edit' &&
      resolveUiState(editor.item).uiDefault &&
      !uiDefault
    ) {
      setFormError(t('languages.uiDefaultCannotDisable'));
      return;
    }
    const otherVisible = items.some(
      (item) =>
        item.code !== editor.item?.code && resolveUiState(item).uiEnabled,
    );
    if (!uiEnabled && !otherVisible) {
      setFormError(t('languages.lastUiEnabled'));
      return;
    }

    const payload = buildLanguagePayload(form, {
      ui: parsedUi.value,
      admin: parsedAdmin.value,
    });

    setSaving(true);
    try {
      if (editor.mode === 'edit') {
        await api.updateLanguage(editor.item.code, payload);
      } else {
        await api.createLanguage({ ...payload, code });
      }
      toast.success(t('languages.saved'));
      setEditor(null);
      await Promise.all([load(), reload()]);
    } catch (err) {
      setFormError(err.message || t('api.networkError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleSetUiVisibility(item) {
    setActionBusy(item.code);
    setError('');
    try {
      await api.updateLanguage(item.code, uiVisibilityPayload(item));
      toast.success(t('languages.saved'));
      await load();
    } catch (err) {
      setError(err.message || t('api.networkError'));
    } finally {
      setActionBusy('');
    }
  }

  async function handleSetUiDefault(item) {
    setActionBusy(item.code);
    setError('');
    try {
      await api.updateLanguage(item.code, uiDefaultPayload());
      toast.success(t('languages.saved'));
      await load();
    } catch (err) {
      setError(err.message || t('api.networkError'));
    } finally {
      setActionBusy('');
    }
  }

  async function handleReset() {
    setResetBusy(true);
    setResetError('');
    try {
      await runLanguageReset({
        client: api,
        loadList: load,
        loadI18n: reload,
        onDone: () => {
          toast.success(t('languages.resetDone'));
          setResetOpen(false);
        },
      });
    } catch (err) {
      setResetError(err.message || t('api.networkError'));
    } finally {
      setResetBusy(false);
    }
  }

  async function handleSetDefault(item) {
    setActionBusy(item.code);
    setError('');
    try {
      await api.updateLanguage(item.code, { isDefault: true });
      toast.success(t('languages.saved'));
      await Promise.all([load(), reload()]);
    } catch (err) {
      setError(err.message || t('api.networkError'));
    } finally {
      setActionBusy('');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.deleteLanguage(deleting.code);
      toast.success(t('languages.deleted'));
      setDeleting(null);
      await Promise.all([load(), reload()]);
    } catch (err) {
      setDeleteError(err.message || t('api.networkError'));
    } finally {
      setDeleteBusy(false);
    }
  }

  const effectiveDefault =
    defaultLocale || items.find((item) => item.isDefault)?.code || '';
  const visibleUiCount = countVisibleUiLocales(items);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('languages.title')}</h2>
          <p>{t('languages.desc')}</p>
          <p className="field-hint">{t('languages.resetHint')}</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setResetError('');
              setResetOpen(true);
            }}
          >
            <Icon name="refresh" /> {t('languages.reset')}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" /> {t('languages.add')}
          </button>
        </div>
      </div>

      <div className="panel">
        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty-state">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <p>{t('languages.desc')}</p>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
              {t('languages.add')}
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <p className="field-hint" style={{ margin: '0 0 10px' }}>
              {t('languages.uiHint')}
            </p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('languages.code')}</th>
                  <th>{t('languages.name')}</th>
                  <th className="align-center">{t('languages.enabled')}</th>
                  <th className="align-center">{t('languages.default')}</th>
                  <th className="align-center">{t('languages.uiColumn')}</th>
                  <th className="align-center">{t('languages.uiDefaultColumn')}</th>
                  <th className="align-center">{t('languages.order')}</th>
                  <th className="align-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isDefault =
                    Boolean(item.isDefault) || item.code === effectiveDefault;
                  const uiState = resolveUiState(item);
                  const isLastUi =
                    uiState.uiEnabled && visibleUiCount <= 1;
                  const canHideUi = uiState.uiEnabled && !isLastUi;
                  const uiToggleTitle = uiState.uiEnabled
                    ? isLastUi
                      ? t('languages.lastUiEnabled')
                      : t('languages.hideFromUi')
                    : t('languages.showOnUi');
                  const uiToggleDisabled =
                    actionBusy === item.code ||
                    (uiState.uiEnabled ? !canHideUi : !item.enabled);
                  const uiDefaultDisabled =
                    actionBusy === item.code ||
                    !uiState.uiEnabled ||
                    uiState.uiDefault;
                  const uiDefaultTitle = !uiState.uiEnabled
                    ? t('languages.uiDefaultNotVisible')
                    : uiState.uiDefault
                      ? t('languages.uiDefault')
                      : t('languages.setUiDefault');
                  return (
                    <tr key={item.code}>
                      <td>
                        <strong className="lang-code">{item.code}</strong>
                      </td>
                      <td>{item.name || item.code}</td>
                      <td className="align-center">
                        <span
                          className={`badge ${item.enabled ? 'badge-published' : 'badge-muted'}`}
                        >
                          {item.enabled ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="align-center">
                        {isDefault ? (
                          <span className="badge badge-featured">
                            {t('languages.default')}
                          </span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="align-center">
                        <span
                          className={`badge ${uiState.uiEnabled ? 'badge-published' : 'badge-muted'}`}
                        >
                          {uiState.uiEnabled ? '✓' : '—'}
                        </span>
                      </td>
                      <td className="align-center">
                        {uiState.uiDefault ? (
                          <span
                            className="badge badge-featured"
                            title={t('languages.uiDefault')}
                          >
                            <Icon name="star" size={12} />
                            {t('languages.uiDefault')}
                          </span>
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td className="align-center">{item.order ?? 0}</td>
                      <td>
                        <div className="row-actions">
                          {!isDefault && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              title={`${t('languages.setDefault')} ${item.name || item.code}`}
                              disabled={actionBusy === item.code}
                              onClick={() => handleSetDefault(item)}
                            >
                              <Icon name="star" size={14} />
                              {t('languages.setDefault')}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title={uiDefaultTitle}
                            disabled={uiDefaultDisabled}
                            onClick={() => handleSetUiDefault(item)}
                          >
                            <Icon name="globe" size={14} />
                            {t('languages.setUiDefault')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title={uiToggleTitle}
                            disabled={uiToggleDisabled}
                            onClick={() => handleSetUiVisibility(item)}
                          >
                            <Icon name="eye" size={14} />
                            {uiState.uiEnabled
                              ? t('languages.hideFromUi')
                              : t('languages.showOnUi')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            title={t('common.edit')}
                            onClick={() => openEdit(item)}
                          >
                            <Icon name="edit" size={14} />
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-danger-text"
                            title={t('common.delete')}
                            onClick={() => {
                              setDeleteError('');
                              setDeleting(item);
                            }}
                          >
                            <Icon name="trash" size={14} />
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editor && (
        <Modal
          title={editor.mode === 'edit' ? t('languages.edit') : t('languages.add')}
          onClose={closeEditor}
          wide
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeEditor}
                disabled={saving || copying}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                form="language-form"
                className="btn btn-primary"
                disabled={saving || copying}
              >
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <form id="language-form" className="form-stack" onSubmit={handleSave}>
            {formError && <div className="alert alert-error">{formError}</div>}

            <div className="form-row">
              <label className="field field-narrow">
                <span>
                  {t('languages.code')} <em className="required">*</em>
                </span>
                <input
                  type="text"
                  name="code"
                  value={form.code}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      code: event.target.value.toLowerCase(),
                    }))
                  }
                  placeholder={t('languages.codeHint')}
                  pattern="[a-z]{2}(-[A-Za-z]{2})?"
                  maxLength={5}
                  readOnly={editor.mode === 'edit'}
                  required
                  autoFocus={editor.mode === 'create'}
                />
                <span className="field-hint">{t('languages.codeHint')}</span>
              </label>

              <label className="field">
                <span>
                  {t('languages.name')} <em className="required">*</em>
                </span>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder={t('languages.nameHint')}
                  required
                  autoFocus={editor.mode === 'edit'}
                />
                <span className="field-hint">{t('languages.nameHint')}</span>
              </label>

              <label className="field field-narrow">
                <span>{t('languages.order')}</span>
                <input
                  type="number"
                  name="order"
                  value={form.order}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, order: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="form-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="enabled"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      enabled: event.target.checked,
                      uiEnabled: event.target.checked ? current.uiEnabled : false,
                      uiDefault: event.target.checked ? current.uiDefault : false,
                    }))
                  }
                />
                <span>{t('languages.enabled')}</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.isDefault}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isDefault: event.target.checked,
                      enabled: event.target.checked ? true : current.enabled,
                    }))
                  }
                />
                <span>{t('languages.default')}</span>
              </label>
              <span className="field-hint">{t('languages.enabledHint')}</span>
            </div>

            <div className="form-row">
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="uiEnabled"
                  checked={form.uiEnabled}
                  disabled={!form.enabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      uiEnabled: event.target.checked,
                      uiDefault: event.target.checked ? current.uiDefault : false,
                    }))
                  }
                />
                <span>{t('languages.uiEnabled')}</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  name="uiDefault"
                  checked={form.uiDefault}
                  disabled={!form.enabled || !form.uiEnabled}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      uiDefault: event.target.checked,
                    }))
                  }
                />
                <span>{t('languages.uiDefault')}</span>
              </label>
            </div>
            <span className="field-hint">{t('languages.uiHint')}</span>

            <div className="editor-actions">
              {editor.mode === 'create' && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleCopyFromEnglish}
                  disabled={copying || saving}
                >
                  {copying ? t('common.loading') : t('languages.copyFrom')}
                </button>
              )}
              <span className="field-hint">{t('languages.messagesHint')}</span>
            </div>

            <label className="field">
              <span>{t('languages.uiMessages')}</span>
              <textarea
                className="code-textarea"
                name="ui"
                value={form.ui}
                onChange={(event) =>
                  setForm((current) => ({ ...current, ui: event.target.value }))
                }
                rows={10}
                spellCheck={false}
              />
            </label>

            <label className="field">
              <span>{t('languages.adminMessages')}</span>
              <textarea
                className="code-textarea"
                name="admin"
                value={form.admin}
                onChange={(event) =>
                  setForm((current) => ({ ...current, admin: event.target.value }))
                }
                rows={12}
                spellCheck={false}
              />
            </label>
          </form>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title={t('languages.title')}
          message={t('languages.deleteConfirm')}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => {
            if (!deleteBusy) setDeleting(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      {resetOpen && (
        <ConfirmDialog
          title={t('languages.reset')}
          message={t('languages.resetConfirm')}
          confirmLabel={t('languages.reset')}
          busy={resetBusy}
          error={resetError}
          onCancel={() => {
            if (!resetBusy) setResetOpen(false);
          }}
          onConfirm={handleReset}
        />
      )}
    </div>
  );
}
