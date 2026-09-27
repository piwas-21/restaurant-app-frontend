'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { CatalogueImportDecision, CatalogueLocalProductType } from '@/services/catalogueImportService';
import type { CatalogueTemplateType } from '@/services/catalogueTemplateService';
import { OrderType } from '@/types/order';
import styles from './CatalogueImportWorkspace.module.css';

interface Props {
  readonly itemType: CatalogueTemplateType;
  readonly decision: CatalogueImportDecision;
  readonly disabled: boolean;
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

const orderTypes = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery] as const;
const localProductTypes: Array<{ value: CatalogueLocalProductType; labelKey: string }> = [
  { value: 'MainItem', labelKey: 'product_type_mainItem' },
  { value: 'Beverage', labelKey: 'product_type_beverage' },
  { value: 'Dessert', labelKey: 'product_type_dessert' },
  { value: 'Sauce', labelKey: 'product_type_sauce' },
  { value: 'AddOn', labelKey: 'product_type_addOn' },
];
const orderTypeLabelKeys = {
  [OrderType.DineIn]: 'order_type_dine_in',
  [OrderType.Takeaway]: 'order_type_takeaway',
  [OrderType.Delivery]: 'order_type_delivery',
} as const;
const kitchenTypes = [
  { value: 'None', key: 'kitchen_type_none' },
  { value: 'FrontKitchen', key: 'kitchen_type_frontkitchen' },
  { value: 'BackKitchen', key: 'kitchen_type_backkitchen' },
] as const;
const checklist: Array<{ key: keyof CatalogueImportDecision; label: string }> = [
  { key: 'ingredientsReviewed', label: 'catalogue_import_review_ingredients' },
  { key: 'allergensReviewed', label: 'catalogue_import_review_allergens' },
  { key: 'availabilityReviewed', label: 'catalogue_import_review_availability' },
  { key: 'channelsReviewed', label: 'catalogue_import_review_channels' },
];

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function orderTypesSelectionValue(value: CatalogueImportDecision['availableOrderTypes']): '' | 'inherit' | 'custom' {
  if (value === undefined) return '';
  if (value === null) return 'inherit';
  return 'custom';
}

export default function CatalogueImportOperationalReview({ itemType, decision, onDecisionChange, disabled }: Props) {
  const { t } = useTranslation();
  if ((itemType !== 'item' && itemType !== 'bundle') || decision.resolution === 'Reuse') return null;
  const creating = decision.resolution === 'Create';

  return (
    <>
      {itemType === 'item' && creating && (
        <FormField label={t('product_type')}>
          <select
            value={decision.localProductType ?? ''}
            disabled={disabled}
            onChange={(event) =>
              onDecisionChange({
                localProductType: (event.target.value || undefined) as CatalogueLocalProductType | undefined,
              })
            }
          >
            <option value="">{t('catalogue_import_choose_product_type')}</option>
            {localProductTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {t(type.labelKey)}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {creating && (
        <>
          <FormField label={t('catalogue_import_intended_availability')}>
            <select
              value={decision.intendedIsAvailable === undefined ? '' : String(decision.intendedIsAvailable)}
              disabled={disabled}
              onChange={(event) => {
                const value = event.target.value;
                onDecisionChange({ intendedIsAvailable: value === '' ? undefined : value === 'true' });
              }}
            >
              <option value="">{t('catalogue_import_choose_availability')}</option>
              <option value="true">{t('available')}</option>
              <option value="false">{t('unavailable')}</option>
            </select>
          </FormField>
          <p className={styles.referenceText}>{t('catalogue_import_import_visibility_note')}</p>
        </>
      )}
      <FormField label={t('catalogue_import_local_ingredients')}>
        <textarea
          value={decision.ingredients?.join(', ') ?? ''}
          disabled={disabled}
          onChange={(event) => onDecisionChange({ ingredients: toList(event.target.value) })}
          rows={2}
        />
      </FormField>
      <FormField label={t('catalogue_import_local_allergens')}>
        <textarea
          value={decision.allergens?.join(', ') ?? ''}
          disabled={disabled}
          onChange={(event) => onDecisionChange({ allergens: toList(event.target.value) })}
          rows={2}
        />
      </FormField>
      {checklist.map((field) => (
        <CheckboxField
          key={field.key}
          label={t(field.label)}
          checked={decision[field.key] === true}
          disabled={disabled}
          onChange={(checked) => onDecisionChange({ [field.key]: checked })}
        />
      ))}
      <fieldset className={styles.orderTypes}>
        <legend>{t('catalogue_import_order_types')}</legend>
        <FormField label={t('product_order_types')}>
          <select
            value={orderTypesSelectionValue(decision.availableOrderTypes)}
            disabled={disabled}
            onChange={(event) => {
              if (event.target.value === 'inherit') onDecisionChange({ availableOrderTypes: null });
              else if (event.target.value === 'custom') onDecisionChange({ availableOrderTypes: [] });
              else onDecisionChange({ availableOrderTypes: undefined });
            }}
          >
            <option value="">{t('select_option')}</option>
            <option value="inherit">{t('product_order_types_inherit')}</option>
            <option value="custom">{t('product_order_types_custom')}</option>
          </select>
        </FormField>
        {Array.isArray(decision.availableOrderTypes) && (
          <>
            {decision.availableOrderTypes.length === 0 && (
              <p role="alert">{t('catalogue_import_order_type_required')}</p>
            )}
            {orderTypes.map((type) => {
              const current = decision.availableOrderTypes ?? [];
              const checked = current.includes(type);
              return (
                <CheckboxField
                  key={type}
                  label={t(orderTypeLabelKeys[type])}
                  checked={checked}
                  disabled={disabled || (checked && current.length === 1)}
                  onChange={(selected) => {
                    onDecisionChange({
                      availableOrderTypes: selected ? [...current, type] : current.filter((value) => value !== type),
                    });
                  }}
                />
              );
            })}
          </>
        )}
      </fieldset>
      {itemType === 'item' && creating && (
        <>
          <FormField label={t('catalogue_import_kitchen_type')}>
            <select
              value={decision.kitchenType ?? ''}
              disabled={disabled}
              onChange={(event) =>
                onDecisionChange({
                  kitchenType: (event.target.value || undefined) as CatalogueImportDecision['kitchenType'],
                })
              }
            >
              <option value="">{t('select_option')}</option>
              {kitchenTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(type.key)}
                </option>
              ))}
            </select>
          </FormField>
          <CheckboxField
            label={t('catalogue_import_review_kitchen')}
            checked={decision.kitchenRoutingReviewed === true}
            disabled={disabled}
            onChange={(checked) => onDecisionChange({ kitchenRoutingReviewed: checked })}
          />
        </>
      )}
    </>
  );
}
