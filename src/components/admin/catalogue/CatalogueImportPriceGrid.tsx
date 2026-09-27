'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import type { CatalogueOptionPriceRef } from '@/hooks/admin/useCatalogueOptionPrices';
import type { CatalogueImportDecision, CatalogueImportSessionItem } from '@/services/catalogueImportService';
import styles from './CatalogueImportPriceGrid.module.css';

export interface CatalogueImportPriceRow {
  readonly item: CatalogueImportSessionItem;
  readonly decision: CatalogueImportDecision;
  readonly priceRefs: readonly CatalogueOptionPriceRef[];
}

interface Props {
  readonly rows: readonly CatalogueImportPriceRow[];
  readonly canEditDecision: (item: CatalogueImportSessionItem) => boolean;
  readonly onDecisionChange: (item: CatalogueImportSessionItem, patch: Partial<CatalogueImportDecision>) => void;
}

function setOptionPrice(decision: CatalogueImportDecision, key: string, value: string) {
  const prices = { ...decision.localOptionPrices };
  if (value.trim() === '') delete prices[key];
  else if (Number.isFinite(Number(value)) && Number(value) >= 0) prices[key] = Number(value);
  return prices;
}

export default function CatalogueImportPriceGrid({ rows, canEditDecision, onDecisionChange }: Props) {
  const { t } = useTranslation();
  const reviewRows = rows.filter(({ item, decision, priceRefs }) => {
    const create = decision.resolution === 'Create';
    return (
      (create && (item.type === 'item' || item.type === 'bundle' || priceRefs.length > 0)) ||
      (item.type === 'option-set' && decision.resolution === 'Reuse')
    );
  });
  if (reviewRows.length === 0) return null;

  return (
    <section className={styles.priceGrid} aria-labelledby="catalogue-price-grid-heading">
      <h2 id="catalogue-price-grid-heading">{t('catalogue_import_price_grid_title')}</h2>
      <p>{t('catalogue_import_option_prices_help')}</p>
      {reviewRows.map(({ item, decision, priceRefs }) => {
        const editable = canEditDecision(item);
        const creating = decision.resolution === 'Create';
        const hasBasePrice = creating && (item.type === 'item' || item.type === 'bundle');
        const hasChoicePrices = creating && priceRefs.length > 0;
        const rulesOnly = item.type === 'option-set' && decision.resolution === 'Reuse';
        return (
          <article key={`${item.templateId}@${item.revision}`} className={styles.priceGridRow}>
            <h3>{item.displayName}</h3>
            {hasBasePrice && (
              <FormField label={t('catalogue_import_price_for', { name: item.displayName })}>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={decision.localPrice ?? ''}
                  disabled={!editable}
                  onChange={(event) =>
                    onDecisionChange(item, {
                      localPrice: event.target.value === '' ? undefined : Number(event.target.value),
                    })
                  }
                />
              </FormField>
            )}
            {hasChoicePrices && (
              <div className={styles.optionPriceRows}>
                {priceRefs.map((ref) => (
                  <FormField key={ref.key} label={t('catalogue_import_price_for', { name: ref.name })}>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={decision.localOptionPrices?.[ref.key] ?? ''}
                      disabled={!editable}
                      onChange={(event) =>
                        onDecisionChange(item, {
                          localOptionPrices: setOptionPrice(decision, ref.key, event.target.value),
                        })
                      }
                    />
                  </FormField>
                ))}
              </div>
            )}
            {hasChoicePrices && (
              <CheckboxField
                label={t('catalogue_import_review_option_prices')}
                checked={decision.optionPricesReviewed === true}
                disabled={!editable}
                onChange={(checked) => onDecisionChange(item, { optionPricesReviewed: checked })}
              />
            )}
            {(hasChoicePrices || rulesOnly) && (
              <CheckboxField
                label={t('catalogue_import_review_choice_rules')}
                checked={decision.choiceRulesReviewed === true}
                disabled={!editable}
                onChange={(checked) => onDecisionChange(item, { choiceRulesReviewed: checked })}
              />
            )}
            {!creating && <p>{t('catalogue_import_reuse_preserves_local')}</p>}
          </article>
        );
      })}
    </section>
  );
}
