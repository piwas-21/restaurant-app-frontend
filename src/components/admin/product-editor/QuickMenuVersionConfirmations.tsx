'use client';

import type { Control } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import CheckboxField from '@/components/design-system/CheckboxField';
import { useTranslation } from 'react-i18next';
import {
  QUICK_MENU_VERSION_CONFIRMATION_FIELDS,
  type QuickMenuVersionConfirmationField,
  type QuickMenuVersionFormInput,
  type QuickMenuVersionFormValues,
} from '@/schemas/quickMenuVersion.schema';
import styles from './QuickMenuVersionModal.module.css';

interface QuickMenuVersionConfirmationsProps {
  readonly control: Control<QuickMenuVersionFormInput, unknown, QuickMenuVersionFormValues>;
  readonly schemaErrors: Readonly<Partial<Record<QuickMenuVersionConfirmationField, string>>>;
}

const FIELD_LABELS: Readonly<Record<QuickMenuVersionConfirmationField, string>> = {
  sectionsConfirmed: 'menu_sections',
  priceConfirmed: 'base_price',
  categoriesConfirmed: 'category',
  scheduleConfirmed: 'menu_availability_schedule',
  channelsConfirmed: 'product_order_types',
};

export default function QuickMenuVersionConfirmations({ control, schemaErrors }: QuickMenuVersionConfirmationsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.confirmations}>
      {QUICK_MENU_VERSION_CONFIRMATION_FIELDS.map((fieldName) => (
        <Controller
          key={fieldName}
          name={fieldName}
          control={control}
          render={({ field, fieldState }) => (
            <CheckboxField
              label={t(FIELD_LABELS[fieldName])}
              checked={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message ?? schemaErrors[fieldName]}
            />
          )}
        />
      ))}
    </div>
  );
}
