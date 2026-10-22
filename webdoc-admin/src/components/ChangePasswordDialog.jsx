import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n/I18nContext';
import { useToast } from './Toast';
import Modal from './Modal';

export default function ChangePasswordDialog({ onClose }) {
  const { t } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const firstInput = useRef(null);

  useEffect(() => {
    firstInput.current?.focus();
  }, []);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.newPassword.length < 6) {
      setError(t('password.tooShort'));
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError(t('password.mismatch'));
      return;
    }

    setSaving(true);
    try {
      await api.changePassword(form.currentPassword, form.newPassword);
      toast.success(t('password.success'));
      onClose();
    } catch (err) {
      setError(err.message || t('password.error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('password.title')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </button>
          <button type="submit" form="change-password-form" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('password.submit')}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="form-stack">
        {error && <div className="alert alert-error">{error}</div>}
        <label className="field">
          <span>{t('password.current')}</span>
          <input
            ref={firstInput}
            type="password"
            value={form.currentPassword}
            onChange={update('currentPassword')}
            autoComplete="current-password"
            required
          />
        </label>
        <label className="field">
          <span>{t('password.new')}</span>
          <input
            type="password"
            value={form.newPassword}
            onChange={update('newPassword')}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        <label className="field">
          <span>{t('password.confirm')}</span>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            autoComplete="new-password"
            required
          />
        </label>
      </form>
    </Modal>
  );
}
