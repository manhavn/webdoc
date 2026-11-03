import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../lib/auth';
import Icon from '../components/Icons';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const ROUTE_OPTIONS = [
  { route: '/', labelKey: 'users.routeOverview' },
  { route: '/docs', labelKey: 'users.routeDocs' },
  { route: '/cms-settings', labelKey: 'users.routeCmsSettings' },
  { route: '/site', labelKey: 'users.routeSite' },
  { route: '/appearance', labelKey: 'users.routeAppearance' },
  { route: '/homepage', labelKey: 'users.routeHomepage' },
  { route: '/languages', labelKey: 'users.routeLanguages' },
  { route: '/backup', labelKey: 'users.routeBackup' },
];

const DEFAULT_USER_ROUTES = ['/', '/docs', '/cms-settings'];

const EMPTY_CREATE_FORM = {
  username: '',
  password: '',
  role: 'editor',
  allowedRoutes: DEFAULT_USER_ROUTES,
};

export default function Users() {
  const { t } = useI18n();
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState('');

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ allowedRoutes: [], password: '', role: 'editor' });
  const [editError, setEditError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.listUsers();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setCreateForm(EMPTY_CREATE_FORM);
    setCreateError('');
    setCreateOpen(true);
  }

  function openEdit(u) {
    setEditTarget(u);
    setEditForm({
      role: u.role || 'editor',
      allowedRoutes: Array.isArray(u.allowedRoutes) && u.allowedRoutes.length > 0
        ? [...u.allowedRoutes]
        : [...DEFAULT_USER_ROUTES],
      password: '',
    });
    setEditError('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    const username = createForm.username.trim();
    if (!username) {
      setCreateError(t('users.usernamePlaceholder'));
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError(t('users.passwordPlaceholder'));
      return;
    }

    setSaving(true);
    setCreateError('');
    try {
      await api.createUser({
        username,
        password: createForm.password,
        role: createForm.role,
        allowedRoutes: createForm.role === 'admin' ? undefined : createForm.allowedRoutes,
      });
      toast.success(t('users.created'));
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateError(err.message || 'Lỗi khi tạo tài khoản');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(e) {
    e.preventDefault();
    if (!editTarget) return;

    if (editForm.password && editForm.password.length < 6) {
      setEditError(t('users.passwordPlaceholder'));
      return;
    }

    setSaving(true);
    setEditError('');
    try {
      const payload = {
        role: editForm.role,
        allowedRoutes: editForm.role === 'admin' ? undefined : editForm.allowedRoutes,
      };
      if (editForm.password) {
        payload.password = editForm.password;
      }
      await api.updateUser(editTarget.id, payload);
      toast.success(t('users.updated'));
      setEditTarget(null);
      load();
    } catch (err) {
      setEditError(err.message || 'Lỗi khi cập nhật tài khoản');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.deleteUser(deleteTarget.id);
      toast.success(t('users.deleted'));
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa tài khoản');
    } finally {
      setDeleteBusy(false);
    }
  }

  function toggleRouteInCreate(route) {
    setCreateForm((current) => {
      const exists = current.allowedRoutes.includes(route);
      return {
        ...current,
        allowedRoutes: exists
          ? current.allowedRoutes.filter((r) => r !== route)
          : [...current.allowedRoutes, route],
      };
    });
  }

  function toggleRouteInEdit(route) {
    setEditForm((current) => {
      const exists = current.allowedRoutes.includes(route);
      return {
        ...current,
        allowedRoutes: exists
          ? current.allowedRoutes.filter((r) => r !== route)
          : [...current.allowedRoutes, route],
      };
    });
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>{t('users.title')}</h2>
          <p className="page-desc">{t('users.subtitle')}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Icon name="plus" size={16} /> {t('users.createUser')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('users.username')}</th>
                <th>{t('users.role')}</th>
                <th>{t('users.allowedRoutes')}</th>
                <th className="align-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="align-center" style={{ padding: 32 }}>
                    <span className="spinner" aria-hidden="true" />
                    <p style={{ marginTop: 8 }}>{t('common.loading')}</p>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="align-center" style={{ padding: 32 }}>
                    <p>{t('users.empty')}</p>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isAdmin = u.role === 'admin';
                  const isCurrent = u.id === currentUser?.id;
                  const routes = Array.isArray(u.allowedRoutes) ? u.allowedRoutes : DEFAULT_USER_ROUTES;

                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="avatar"
                            style={{
                              width: 28,
                              height: 28,
                              fontSize: 12,
                              background: isAdmin ? 'var(--accent)' : 'var(--border-soft)',
                              color: isAdmin ? '#fff' : 'var(--text)',
                            }}
                          >
                            {u.username?.charAt(0).toUpperCase()}
                          </span>
                          <strong>@{u.username}</strong>
                          {isCurrent && (
                            <span className="badge badge-published" style={{ fontSize: 10 }}>
                              Bạn
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isAdmin ? 'badge-featured' : 'badge-muted'}`}>
                          {isAdmin ? t('users.roleAdmin') : t('users.roleEditor')}
                        </span>
                      </td>
                      <td>
                        {isAdmin ? (
                          <span className="badge badge-featured">{t('users.fullAccess')}</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {ROUTE_OPTIONS.filter((opt) => routes.includes(opt.route)).map((opt) => (
                              <span
                                key={opt.route}
                                className="badge badge-muted"
                                style={{ fontSize: 11 }}
                              >
                                {t(opt.labelKey)}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="align-right">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(u)}
                            title={t('users.editPermissions')}
                          >
                            <Icon name="edit" size={14} />
                            {t('users.editPermissions')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(u)}
                            disabled={isCurrent}
                            title={isCurrent ? 'Không thể tự xóa chính mình' : t('common.delete')}
                            style={{ color: isCurrent ? 'var(--muted)' : 'var(--error, #ef4444)' }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {createOpen && (
        <Modal
          title={t('users.createUser')}
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" form="create-user-form" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('users.createUser')}
              </button>
            </>
          }
        >
          <form id="create-user-form" className="form-stack" onSubmit={handleCreate}>
            {createError && <div className="alert alert-error">{createError}</div>}

            <label className="field">
              <span>{t('users.username')} <em className="required">*</em></span>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder={t('users.usernamePlaceholder')}
                autoFocus
                required
              />
            </label>

            <label className="field">
              <span>{t('users.password')} <em className="required">*</em></span>
              <input
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder={t('users.passwordPlaceholder')}
                required
              />
            </label>

            <label className="field">
              <span>{t('users.role')}</span>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              >
                <option value="editor">{t('users.roleEditor')}</option>
                <option value="admin">{t('users.roleAdmin')}</option>
              </select>
            </label>

            {createForm.role !== 'admin' && (
              <div className="field">
                <span>{t('users.allowedRoutes')}</span>
                <small className="field-hint" style={{ marginBottom: 10, display: 'block' }}>
                  {t('users.allowedRoutesHint')}
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {ROUTE_OPTIONS.map((opt) => {
                    const checked = createForm.allowedRoutes.includes(opt.route);
                    return (
                      <label
                        key={opt.route}
                        className={`badge ${checked ? 'badge-published' : 'badge-muted'}`}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          fontSize: 12.5,
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRouteInCreate(opt.route)}
                        />
                        <span>{t(opt.labelKey)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Edit User Permissions Modal */}
      {editTarget && (
        <Modal
          title={`${t('users.editPermissions')} — @${editTarget.username}`}
          onClose={() => setEditTarget(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEditTarget(null)}
                disabled={saving}
              >
                {t('common.cancel')}
              </button>
              <button type="submit" form="edit-user-form" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            </>
          }
        >
          <form id="edit-user-form" className="form-stack" onSubmit={handleUpdate}>
            {editError && <div className="alert alert-error">{editError}</div>}

            <label className="field">
              <span>{t('users.role')}</span>
              <select
                value={editForm.role}
                disabled={editTarget.id === currentUser?.id}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="editor">{t('users.roleEditor')}</option>
                <option value="admin">{t('users.roleAdmin')}</option>
              </select>
            </label>

            <label className="field">
              <span>{t('users.newPasswordOptional')}</span>
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder={t('users.passwordPlaceholder')}
              />
            </label>

            {editForm.role !== 'admin' && (
              <div className="field">
                <span>{t('users.allowedRoutes')}</span>
                <small className="field-hint" style={{ marginBottom: 10, display: 'block' }}>
                  {t('users.allowedRoutesHint')}
                </small>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {ROUTE_OPTIONS.map((opt) => {
                    const checked = editForm.allowedRoutes.includes(opt.route);
                    return (
                      <label
                        key={opt.route}
                        className={`badge ${checked ? 'badge-published' : 'badge-muted'}`}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          fontSize: 12.5,
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRouteInEdit(opt.route)}
                        />
                        <span>{t(opt.labelKey)}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Delete User Confirm Dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title={t('users.deleteConfirmTitle')}
          message={t('users.deleteConfirmMessage', { username: deleteTarget.username })}
          busy={deleteBusy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
