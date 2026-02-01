import { useTranslation } from 'react-i18next';
import styles from './CustomerDetailsForm.module.css';

interface CustomerDetailsFormProps {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  specialRequests: string;
  onNameChange: (name: string) => void;
  onEmailChange: (email: string) => void;
  onPhoneChange: (phone: string) => void;
  onSpecialRequestsChange: (requests: string) => void;
}

export default function CustomerDetailsForm({
  customerName,
  customerEmail,
  customerPhone,
  specialRequests,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onSpecialRequestsChange
}: CustomerDetailsFormProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.formSection}>
      <label className={styles.label}>{t('your_details', 'Your Details')}</label>

      <input
        type="text"
        placeholder={t('your_name', 'Your Name')}
        value={customerName}
        onChange={(e) => onNameChange(e.target.value)}
        className={styles.input}
        required
      />

      <input
        type="email"
        placeholder={t('your_email', 'Your Email')}
        value={customerEmail}
        onChange={(e) => onEmailChange(e.target.value)}
        className={styles.input}
        required
      />

      <input
        type="tel"
        placeholder={t('your_phone_optional', 'Your Phone')}
        value={customerPhone}
        onChange={(e) => onPhoneChange(e.target.value)}
        className={styles.input}
        required
      />

      <textarea
        placeholder={t('special_requests_placeholder', 'Allergies, dietary requirements, special occasions, etc.')}
        value={specialRequests}
        onChange={(e) => onSpecialRequestsChange(e.target.value)}
        className={styles.textarea}
        rows={3}
      />
    </div>
  );
}
