'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { CatalogueImportDecision } from '@/services/catalogueImportService';
import type { CatalogueTemplateType } from '@/services/catalogueTemplateService';
import styles from './CatalogueImportOperationalReview.module.css';

interface Props {
  readonly itemType: CatalogueTemplateType;
  readonly decision: CatalogueImportDecision;
  readonly disabled: boolean;
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

function toList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CatalogueImportRecipeReview({ itemType, decision, disabled, onDecisionChange }: Props) {
  const { t } = useTranslation();
  const isItem = itemType === 'item';

  return (
    <section className={styles.group} aria-label={t('editor_section_recipe')}>
      <h3 className={styles.heading}>{t('editor_section_recipe')}</h3>
      <p className={styles.guidance}>
        {t(isItem ? 'catalogue_import_recipe_review_help' : 'catalogue_import_bundle_recipe_review_help')}
      </p>
      <div className={styles.reviewPair}>
        {isItem && (
          <FormField label={t('catalogue_import_local_ingredients')}>
            <textarea
              value={decision.ingredients?.join(', ') ?? ''}
              disabled={disabled}
              onChange={(event) => onDecisionChange({ ingredients: toList(event.target.value) })}
              rows={2}
            />
          </FormField>
        )}
        <CheckboxField
          label={t(isItem ? 'catalogue_import_review_ingredients' : 'catalogue_import_review_bundle_ingredients')}
          checked={decision.ingredientsReviewed === true}
          disabled={disabled}
          onChange={(checked) =>
            onDecisionChange({
              ingredientsReviewed: checked,
              ...(checked && isItem ? { ingredients: decision.ingredients ?? [] } : {}),
            })
          }
        />
      </div>
      <div className={styles.reviewPair}>
        <FormField label={t('catalogue_import_local_allergens')}>
          <textarea
            value={decision.allergens?.join(', ') ?? ''}
            disabled={disabled}
            onChange={(event) => onDecisionChange({ allergens: toList(event.target.value) })}
            rows={2}
          />
        </FormField>
        <CheckboxField
          label={t('catalogue_import_review_allergens')}
          checked={decision.allergensReviewed === true}
          disabled={disabled}
          onChange={(checked) =>
            onDecisionChange({
              allergensReviewed: checked,
              ...(checked ? { allergens: decision.allergens ?? [] } : {}),
            })
          }
        />
      </div>
    </section>
  );
}
