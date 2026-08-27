import React from 'react';
import styles from './ConfirmationModal.module.css';
import { useTranslation } from 'react-i18next';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, message }) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>{t('confirmation')}</h2>
        <p>{message}</p>
        {/* `type="button"` on BOTH, and it is load-bearing rather than tidy: a bare <button>
            defaults to type="submit", so every one of this modal's confirmations ALSO submitted
            whatever form it happened to be rendered inside. That is why the item editor's image
            gallery had to live outside the product form ("delete this image → Yes" saved the
            product), and it is a live hazard for the bundle editor's section-delete confirm, which
            sits inside that form today. */}
        <div className={styles.buttonGroup}>
          <button type="button" onClick={onConfirm} className={styles.submitButton}>
            {t('yes')}
          </button>
          <button type="button" onClick={onClose} className={styles.cancelButton}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
