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
  onSpecialRequestsChange,
}: CustomerDetailsFormProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.formSection}>
      <label className={styles.label}>{t('your_details', 'Your Details')}</label>

      {/* Design uses placeholders as the visual label (no per-field labels), so
          each control also carries an aria-label for an accessible name — axe's
          `label` rule doesn't accept placeholder alone. */}
      <input
        type="text"
        aria-label={t('your_name', 'Your Name')}
        placeholder={t('your_name', 'Your Name')}
        value={customerName}
        onChange={(e) => onNameChange(e.target.value)}
        className={styles.input}
        required
      />

      <input
        type="email"
        aria-label={t('your_email', 'Your Email')}
        placeholder={t('your_email', 'Your Email')}
        value={customerEmail}
        onChange={(e) => onEmailChange(e.target.value)}
        className={styles.input}
        required
      />

      <input
        type="tel"
        aria-label={t('your_phone_optional', 'Your Phone')}
        placeholder={t('your_phone_optional', 'Your Phone')}
        value={customerPhone}
        onChange={(e) => onPhoneChange(e.target.value)}
        className={styles.input}
        required
      />

      <textarea
        aria-label={t('special_requests', 'Special requests')}
        placeholder={t('special_requests_placeholder', 'Allergies, dietary requirements, special occasions, etc.')}
        value={specialRequests}
        onChange={(e) => onSpecialRequestsChange(e.target.value)}
        className={styles.textarea}
        rows={3}
      />
    </div>
  );
}
