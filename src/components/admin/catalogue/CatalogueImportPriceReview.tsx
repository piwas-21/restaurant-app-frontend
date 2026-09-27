'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { CatalogueImportDecision } from '@/services/catalogueImportService';
import type { CatalogueTemplateType } from '@/services/catalogueTemplateService';
import type { CatalogueOptionPriceRef } from '@/hooks/admin/useCatalogueOptionPrices';
import styles from './CatalogueImportWorkspace.module.css';

interface Props {
  readonly templateType: CatalogueTemplateType;
  readonly decision: CatalogueImportDecision;
  readonly priceRefs: readonly CatalogueOptionPriceRef[];
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

export default function CatalogueImportPriceReview({ templateType, decision, priceRefs, onDecisionChange }: Props) {
  const { t } = useTranslation();
  const reusedOptionSet = templateType === 'option-set' && decision.resolution === 'Reuse';
  const choiceReviewOnly = reusedOptionSet || (priceRefs.length === 0 && templateType === 'option-set');
  const updatePrice = (key: string, value: string) => {
    const next = { ...decision.localOptionPrices };
    if (value.trim() === '') delete next[key];
    else if (Number.isFinite(Number(value)) && Number(value) >= 0) next[key] = Number(value);
    onDecisionChange({ localOptionPrices: next });
  };

  if (choiceReviewOnly) {
    return (
      <CheckboxField
        label={t('catalogue_import_review_choice_rules')}
        checked={decision.choiceRulesReviewed === true}
        onChange={(checked) => onDecisionChange({ choiceRulesReviewed: checked })}
      />
    );
  }
  if (priceRefs.length === 0) return null;

  return (
    <section className={styles.priceGrid} aria-label={t('catalogue_import_option_prices')}>
      <h3>{t('catalogue_import_option_prices')}</h3>
      <p>{t('catalogue_import_option_prices_help')}</p>
      {priceRefs.map((ref) => (
        <FormField key={ref.key} label={t('catalogue_import_price_for', { name: ref.name })}>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={decision.localOptionPrices?.[ref.key] ?? ''}
            onChange={(event) => updatePrice(ref.key, event.target.value)}
          />
        </FormField>
      ))}
      <CheckboxField
        label={t('catalogue_import_review_option_prices')}
        checked={decision.optionPricesReviewed === true}
        onChange={(checked) => onDecisionChange({ optionPricesReviewed: checked })}
      />
      <CheckboxField
        label={t('catalogue_import_review_choice_rules')}
        checked={decision.choiceRulesReviewed === true}
        onChange={(checked) => onDecisionChange({ choiceRulesReviewed: checked })}
      />
    </section>
  );
}
