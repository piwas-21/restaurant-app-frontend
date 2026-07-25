'use client';

import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useCustomerFormsAdmin, toTriState, type FieldTriState } from '@/hooks/admin/useCustomerFormsAdmin';
import { customerFormTitle, customerFormFieldLabel } from '@/utils/customerFormLabels';
import styles from './CustomerFormsPage.module.css';

export default function CustomerFormsPage() {
  const { t } = useTranslation();
  const { forms, loading, savingFormKey, setFieldState, isDirty, saveForm } = useCustomerFormsAdmin();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t('admin_customer_forms_title', 'Customer Forms')}</h1>
        <p className={styles.subtitle}>
          {t('customer_forms_desc', 'Choose which fields customers see — and must fill in — on each form')}
        </p>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      ) : (
        forms.map((form) => (
          <section key={form.formKey} className={styles.formCard} aria-label={customerFormTitle(t, form.formKey)}>
            <h2 className={styles.formTitle}>{customerFormTitle(t, form.formKey)}</h2>

            <div className={styles.fields}>
              {form.fields.map((field) => {
                const selectId = `customer-forms-${form.formKey}-${field.fieldKey}`;
                return (
                  <div key={field.fieldKey} className={styles.fieldRow}>
                    <FormField
                      label={customerFormFieldLabel(t, field.fieldKey)}
                      htmlFor={selectId}
                      className={styles.fieldControl}
                    >
                      <select
                        id={selectId}
                        className={styles.stateSelect}
                        value={toTriState(field)}
                        disabled={field.isLocked || savingFormKey !== null}
                        onChange={(e) => setFieldState(form.formKey, field.fieldKey, e.target.value as FieldTriState)}
                      >
                        <option value="hidden">{t('customer_forms_state_hidden', 'Hidden')}</option>
                        <option value="optional">{t('customer_forms_state_optional', 'Optional')}</option>
                        <option value="required">{t('customer_forms_state_required', 'Required')}</option>
                      </select>
                    </FormField>

                    {field.isLocked && (
                      <div className={styles.lockedHint}>
                        <StatusBadge tone="neutral" className={styles.lockedBadge}>
                          <Lock size={12} aria-hidden="true" />
                          {t('customer_forms_locked', 'Locked')}
                        </StatusBadge>
                        <span className={styles.lockedText}>
                          {t('customer_forms_locked_hint', 'Always visible and required — needed for this flow')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className={styles.saveButton}
              onClick={() => saveForm(form.formKey)}
              disabled={!isDirty(form.formKey) || savingFormKey !== null}
            >
              {savingFormKey === form.formKey ? t('saving', 'Saving...') : t('save_changes', 'Save Changes')}
            </button>
          </section>
        ))
      )}
    </div>
  );
}
