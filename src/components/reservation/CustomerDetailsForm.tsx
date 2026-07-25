import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { useCustomerFormFields } from '@/hooks/useCustomerFormFields';
import { FORM_KEYS } from '@/types/formFieldConfig';
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

/**
 * Reservation guest-details form. Field visibility/requiredness comes from the
 * admin-configured form-field rules (safe fallback = name/email required,
 * phone/special requests optional — today's behaviour). Each field uses the
 * FormField primitive, so every control has a real, visible label.
 */
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
  const { rules } = useCustomerFormFields(FORM_KEYS.reservation);

  const isVisible = (fieldKey: string) => rules[fieldKey]?.isVisible !== false;
  const isRequired = (fieldKey: string) => rules[fieldKey]?.isRequired === true;
  // Visual required indicator; validation is enforced on submit (and mirrors the backend).
  const withMarker = (label: string, fieldKey: string) => (isRequired(fieldKey) ? `${label} *` : label);

  return (
    <div className={styles.formSection}>
      <span className={styles.label}>{t('your_details', 'Your Details')}</span>

      <FormField label={withMarker(t('your_name', 'Your Name'), 'customerName')}>
        <input
          type="text"
          placeholder={t('your_name', 'Your Name')}
          value={customerName}
          onChange={(e) => onNameChange(e.target.value)}
          className={styles.input}
          required={isRequired('customerName')}
        />
      </FormField>

      <FormField label={withMarker(t('your_email', 'Your Email'), 'customerEmail')}>
        <input
          type="email"
          placeholder={t('your_email', 'Your Email')}
          value={customerEmail}
          onChange={(e) => onEmailChange(e.target.value)}
          className={styles.input}
          required={isRequired('customerEmail')}
        />
      </FormField>

      {isVisible('customerPhone') && (
        <FormField label={withMarker(t('your_phone_optional', 'Your Phone'), 'customerPhone')}>
          <input
            type="tel"
            placeholder={t('your_phone_optional', 'Your Phone')}
            value={customerPhone}
            onChange={(e) => onPhoneChange(e.target.value)}
            className={styles.input}
            required={isRequired('customerPhone')}
          />
        </FormField>
      )}

      {isVisible('specialRequests') && (
        <FormField label={withMarker(t('special_requests', 'Special requests'), 'specialRequests')}>
          <textarea
            placeholder={t('special_requests_placeholder', 'Allergies, dietary requirements, special occasions, etc.')}
            value={specialRequests}
            onChange={(e) => onSpecialRequestsChange(e.target.value)}
            className={styles.textarea}
            rows={3}
            required={isRequired('specialRequests')}
          />
        </FormField>
      )}
    </div>
  );
}
