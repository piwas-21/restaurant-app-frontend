'use client';

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DetailedProduct } from '@/types/menu';
import { buildProductSteps } from '@/utils/customizationSteps';
import { isBaseRowHidden } from '@/utils/baseProductVisibility';
import { buildInitialSheetState } from '@/utils/itemSheetState';
import { isSauce } from '@/utils/sauceGroup';
import { groupSuggestedSideItems } from '@/utils/suggestedSideItems';
import styles from './CatalogueImportGuestReview.module.css';

interface Props {
  readonly product: DetailedProduct;
  readonly locale: string;
}

function translatedContentName(
  content: Record<string, { name: string }> | undefined,
  locale: string,
  fallback: string,
) {
  const language = locale.split('-')[0];
  return content?.[locale]?.name || content?.[language]?.name || content?.en?.name || fallback;
}

function translatedIngredientName(
  ingredient: { name: string; content?: Record<string, { name: string }> },
  locale: string,
) {
  return translatedContentName(ingredient.content, locale, ingredient.name);
}

function ChoiceList({
  labels,
  defaults,
  t,
}: {
  readonly labels: readonly { id: string; name: string; isDefault?: boolean; note?: string }[];
  readonly defaults?: ReadonlySet<string>;
  readonly t: ReturnType<typeof useTranslation>['t'];
}) {
  if (labels.length === 0) return <p className={styles.empty}>{t('catalogue_import_guest_no_choices')}</p>;
  return (
    <ul className={styles.choiceList}>
      {labels.map((choice) => (
        <li key={choice.id}>
          <span>{choice.name}</span>
          {choice.note && <span className={styles.defaultChoice}>{choice.note}</span>}
          {!choice.note && (choice.isDefault || defaults?.has(choice.id)) && (
            <span className={styles.defaultChoice}>{t('bundle_preview_included_by_default')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Renders the saved Product steps in the same sequence the guest customizer derives. */
export default function CatalogueImportedItemChoices({ product, locale }: Props) {
  const { t } = useTranslation();
  const defaults = useMemo(() => buildInitialSheetState(product), [product]);
  const selectedIngredients = useMemo(() => new Set(defaults.selectedIngredients), [defaults.selectedIngredients]);
  const steps = useMemo(() => buildProductSteps(product), [product]);
  const activeIngredients = (product.detailedIngredients ?? []).filter((ingredient) => ingredient.isActive);
  const sides = groupSuggestedSideItems(product.suggestedSideItems ?? []);
  const ingredientById = new Map((product.detailedIngredients ?? []).map((ingredient) => [ingredient.id, ingredient]));

  return (
    <div className={styles.stepList}>
      <h4>{t('catalogue_import_guest_choices')}</h4>
      {steps.length === 0 ? (
        <p className={styles.empty}>{t('catalogue_import_guest_no_choices')}</p>
      ) : (
        steps.map((step) => {
          let heading: string;
          if (step.group) heading = translatedContentName(step.group.content, locale, step.group.name);
          else if (step.title) heading = step.title;
          else if (step.titleKey) heading = t(step.titleKey);
          else heading = step.kind;
          let choices: { id: string; name: string; isDefault?: boolean; note?: string }[] = [];
          if (step.kind === 'variations') {
            const rows = (product.variations ?? []).filter((row) => row.isActive);
            choices = rows
              .slice()
              .sort((left, right) => left.displayOrder - right.displayOrder)
              .map((row) => ({
                id: row.id,
                name: translatedContentName(row.content, locale, row.name),
                isDefault: row.id === defaults.selectedVariationId,
              }));
            if (!isBaseRowHidden(product.hideBaseProduct, product.variations)) {
              choices.unshift({
                id: 'base',
                name: translatedContentName(product.content, locale, product.name),
                isDefault: defaults.selectedVariationId === null,
              });
            }
          } else if (step.kind === 'group' && step.group) {
            choices = [
              ...step.group.ingredientOptions.map((option) => ({
                id: option.id,
                name: translatedIngredientName(
                  ingredientById.get(option.productIngredientId) ?? { name: option.productIngredientId },
                  locale,
                ),
                isDefault: option.isDefault,
              })),
              ...step.group.productOptions.map((option) => ({
                id: option.id,
                name: option.optionProductName,
                isDefault: option.isDefault,
              })),
            ];
          } else if (step.kind === 'ingredients' || step.kind === 'sauces') {
            choices = activeIngredients
              .filter((ingredient) => isSauce(ingredient) === (step.kind === 'sauces'))
              .map((ingredient) => ({ id: ingredient.id, name: translatedIngredientName(ingredient, locale) }));
          } else if (step.kind === 'sides' && step.sideGroup) {
            choices = (sides.find((group) => group.id === step.sideGroup)?.items ?? []).map((side) => ({
              id: side.id,
              name: side.name,
              note: t(side.isRequired ? 'required' : 'optional'),
            }));
          }
          const selected = step.kind === 'ingredients' || step.kind === 'sauces' ? selectedIngredients : undefined;
          return (
            <section className={styles.step} key={step.id}>
              <h5 className={styles.stepTitle}>{heading}</h5>
              {step.kind === 'review' ? (
                <p className={styles.empty}>{t('bundle_guest_preview_description')}</p>
              ) : (
                <ChoiceList labels={choices} defaults={selected} t={t} />
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
