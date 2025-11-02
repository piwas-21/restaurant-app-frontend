import { useTranslation } from 'react-i18next';
import styles from './CapacityWarning.module.css';

interface CapacityWarningProps {
  numberOfGuests: number;
}

export default function CapacityWarning({ numberOfGuests }: CapacityWarningProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.capacityWarning}>
      <div className={styles.warningIcon}>⚠️</div>
      <div className={styles.warningContent}>
        <p className={styles.warningTitle}>
          {t('capacity_notice', 'Capacity Notice')}
        </p>
        <p className={styles.warningMessage}>
          {t('capacity_warning_message',
            'We don\'t have a single table that can accommodate all {{guests}} guests. However, you can select multiple tables and request to combine them, or proceed with your selection and our staff will review your request to find the best arrangement.',
            { guests: numberOfGuests }
          )}
        </p>
        <p className={styles.warningAction}>
          {t('select_multiple_tables_suggestion', '💡 Tip: Select multiple tables and use the "combine tables" option below.')}
        </p>
      </div>
    </div>
  );
}
