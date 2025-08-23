import React from 'react';
import styles from '@/app/styles/RegisterStaffModal.module.css'; // Re-using modal styles
import { useTranslation } from 'react-i18next';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  isSuccess: boolean;
}

const ResultModal: React.FC<ResultModalProps> = ({ isOpen, onClose, message, isSuccess }) => {
  const { t } = useTranslation();

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>{isSuccess ? t('success') : t('error')}</h2>
        <p>{message}</p>
        <div className={styles.buttonGroup}>
          <button onClick={onClose} className={isSuccess ? styles.submitButton : styles.cancelButton}>
            {t('ok')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
