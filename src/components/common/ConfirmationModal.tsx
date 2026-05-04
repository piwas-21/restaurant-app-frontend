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
        <div className={styles.buttonGroup}>
          <button onClick={onConfirm} className={styles.submitButton}>
            {t('yes')}
          </button>
          <button onClick={onClose} className={styles.cancelButton}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
