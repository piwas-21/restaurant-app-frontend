/**
 * Kitchen Type Selector Component
 *
 * Allows selection of kitchen type (Front, Back, or None) for products
 */

'use client';

import { useTranslation } from 'react-i18next';
import { KitchenType, KITCHEN_TYPES } from '@/types/menu';
import { getKitchenTypeColor } from '@/utils/kitchenTypeDisplay';

interface KitchenTypeSelectorProps {
  value: KitchenType | undefined;
  onChange: (kitchenType: KitchenType) => void;
  disabled?: boolean;
  error?: string;
}

export default function KitchenTypeSelector({
  value,
  onChange,
  disabled = false,
  error,
}: KitchenTypeSelectorProps) {
  const { t } = useTranslation();

  const kitchenTypeOptions = Object.entries(KITCHEN_TYPES).map(([key, config]) => ({
    value: key as KitchenType,
    label: t(`kitchen_type_${key.toLowerCase()}`, config.label),
  }));

  return (
    <div style={{ marginBottom: '1rem' }}>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
        {t('kitchen_type', 'Kitchen Type')}
      </label>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {kitchenTypeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: `2px solid ${value === option.value ? getKitchenTypeColor(option.value) : '#D1D5DB'}`,
              backgroundColor: value === option.value ? `${getKitchenTypeColor(option.value)}20` : '#FFFFFF',
              color: value === option.value ? '#000000' : '#6B7280',
              fontWeight: value === option.value ? 600 : 400,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <p style={{ color: '#DC2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
