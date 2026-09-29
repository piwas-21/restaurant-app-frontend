import type { OptionSetEntry } from '@/types/optionSet';
import type { OptionSetTargetSettings } from '@/types/optionSetMaterialization';
import { formatCurrency } from '@/utils/currency';

const settingLabels: Readonly<Record<string, string>> = {
  minSelection: 'minimum_selection',
  maxSelection: 'maximum_selection',
  includedFree: 'sauce_included_free_label',
  displayOrder: 'display_order',
};

export function optionSetSettingLabel(name: string): string {
  const key = name[0].toLowerCase() + name.slice(1);
  return settingLabels[key] ?? name;
}

export function optionSetSettingValue(settings: OptionSetTargetSettings, name: string): string {
  const key = (name[0].toLowerCase() + name.slice(1)) as keyof OptionSetTargetSettings;
  return String(settings[key] ?? '—');
}

const labels: Readonly<Record<string, string>> = {
  name: 'option_set_entry_name',
  displayOrder: 'display_order',
  isOptional: 'ingredient_is_optional',
  maxQuantity: 'option_set_entry_max_quantity',
  price: 'option_set_entry_price',
  isIncludedInBasePrice: 'option_set_entry_included',
  isActive: 'active',
  isRequired: 'option_set_override_required',
  additionalPrice: 'option_set_entry_additional_price',
  isDefault: 'option_set_entry_default',
};

/** Translate changed-field keys and show the set's proposed value when available. */
export function describeOptionSetField(
  field: string,
  entry: OptionSetEntry | undefined,
  translate: (key: string) => string,
): string {
  const key = field[0].toLowerCase() + field.slice(1);
  const label = translate(labels[key] ?? key);
  if (!entry) return label;
  if (key === 'price' || key === 'additionalPrice') return `${label}: ${formatCurrency(entry[key])}`;
  if (key === 'isActive') return `${label}: ${translate('yes')}`;
  if (key === 'name' || key === 'displayOrder' || key === 'maxQuantity') return `${label}: ${entry[key]}`;
  if (key === 'isOptional' || key === 'isIncludedInBasePrice' || key === 'isRequired' || key === 'isDefault') {
    return `${label}: ${translate(entry[key] ? 'yes' : 'no')}`;
  }
  return label;
}
