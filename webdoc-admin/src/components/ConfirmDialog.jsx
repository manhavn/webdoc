import Modal from './Modal';
import { useI18n } from '../i18n/I18nContext';

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  error = '',
  onConfirm,
  onCancel,
}) {
  const { t } = useI18n();

  return (
    <Modal
      title={title || t('confirm.title')}
      onClose={busy ? () => {} : onCancel}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel || t('common.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? t('common.processing') : confirmLabel || t('common.delete')}
          </button>
        </>
      }
    >
      {error && <div className="alert alert-error">{error}</div>}
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
