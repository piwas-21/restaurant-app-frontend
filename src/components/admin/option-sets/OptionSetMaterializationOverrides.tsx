'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import type { OptionSetEntryOverride } from '@/types/optionSetMaterialization';
import styles from './OptionSetMaterializationTargetCard.module.css';

const labels: Record<keyof OptionSetEntryOverride, string> = {
  name: 'option_set_entry_name',
  displayOrder: 'display_order',
  isOptional: 'ingredient_is_optional',
  maxQuantity: 'option_set_entry_max_quantity',
  price: 'option_set_entry_price',
  isIncludedInBasePrice: 'option_set_entry_included',
  isRequired: 'option_set_override_required',
  additionalPrice: 'option_set_entry_additional_price',
  isDefault: 'option_set_entry_default',
};

const booleanFields: ReadonlySet<keyof OptionSetEntryOverride> = new Set([
  'isOptional',
  'isIncludedInBasePrice',
  'isRequired',
  'isDefault',
]);

export function optionSetOverrideFields(kind: OptionSetKind): Array<keyof OptionSetEntryOverride> {
  if (kind === 'ingredient' || kind === 'sauce') {
    return ['name', 'displayOrder', 'price', 'isOptional', 'maxQuantity', 'isIncludedInBasePrice'];
  }
  if (kind === 'bundleChoice') return ['name', 'displayOrder', 'additionalPrice', 'isRequired', 'isDefault'];
  return [];
}

function numberValue(value: string): number | undefined {
  return value.trim() && Number.isFinite(Number(value)) ? Number(value) : undefined;
}

interface OverrideFieldProps {
  readonly field: keyof OptionSetEntryOverride;
  readonly value: string | number | boolean | undefined;
  readonly onChange: (value: string) => void;
}

function OverrideField({ field, value, onChange }: OverrideFieldProps) {
  const { t } = useTranslation();
  if (booleanFields.has(field)) {
    return (
      <FormField label={t(labels[field])}>
        <select value={value === undefined ? '' : String(value)} onChange={(event) => onChange(event.target.value)}>
          <option value="">{t('option_set_override_no_change')}</option>
          <option value="true">{t('yes')}</option>
          <option value="false">{t('no')}</option>
        </select>
      </FormField>
    );
  }
  return (
    <FormField label={t(labels[field])}>
      <input
        type={field === 'name' ? 'text' : 'number'}
        min={field === 'name' ? undefined : 0}
        step={field === 'price' || field === 'additionalPrice' ? '0.01' : '1'}
        value={value === undefined ? '' : String(value)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

interface Props {
  readonly kind: OptionSetKind;
  readonly entries: readonly OptionSetEntry[];
  readonly overrides: Readonly<Record<string, OptionSetEntryOverride>>;
  readonly onChange: (overrides: Readonly<Record<string, OptionSetEntryOverride>>) => void;
}

export default function OptionSetMaterializationOverrides({ kind, entries, overrides, onChange }: Props) {
  const { t } = useTranslation();
  const fields = optionSetOverrideFields(kind);
  if (!fields.length) return null;

  const update = (entryId: string, field: keyof OptionSetEntryOverride, value: string) => {
    const next: Record<string, string | number | boolean> = { ...overrides[entryId] };
    if (booleanFields.has(field)) {
      if (value === '') delete next[field];
      else next[field] = value === 'true';
    } else if (field === 'name') {
      if (value.trim()) next.name = value;
      else delete next.name;
    } else {
      const parsed = numberValue(value);
      if (parsed === undefined) delete next[field];
      else next[field] = parsed;
    }
    const allOverrides = { ...overrides };
    if (Object.keys(next).length) allOverrides[entryId] = next as OptionSetEntryOverride;
    else delete allOverrides[entryId];
    onChange(allOverrides);
  };

  return (
    <details className={styles.overrides} open>
      <summary>{t('option_set_entry_overrides')}</summary>
      {entries
        .filter((entry): entry is OptionSetEntry & { id: string } => Boolean(entry.id))
        .map((entry) => (
          <fieldset className={styles.entryOverride} key={entry.id}>
            <legend>{entry.name}</legend>
            {fields.map((field) => (
              <OverrideField
                key={field}
                field={field}
                value={overrides[entry.id]?.[field]}
                onChange={(value) => update(entry.id, field, value)}
              />
            ))}
          </fieldset>
        ))}
    </details>
  );
}
