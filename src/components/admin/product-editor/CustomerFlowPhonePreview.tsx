'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { stepLabel } from '@/components/menu/customization/stepLabel';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { DetailedProduct } from '@/types/menu';
import { formatPlainCurrency } from '@/utils/currency';
import { localizedName } from '@/utils/localizedContent';
import BidiTemplate from '@/components/common/BidiTemplate';
import styles from './CustomerFlowPhonePreview.module.css';

interface Props {
  readonly steps: readonly CustomizationStep[];
  readonly price: number;
  readonly itemName: string;
  readonly isBundle: boolean;
  readonly product?: DetailedProduct;
  readonly currentLanguage: string;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Read-only phone rendering of the same planner screens and CTA the guest sees. */
export default function CustomerFlowPhonePreview({
  steps,
  price,
  itemName,
  isBundle,
  product,
  currentLanguage,
}: Props) {
  const { t } = useTranslation();
  const [selectedStepId, setSelectedStepId] = useState(steps[0]?.id ?? null);
  const active = steps.find((step) => step.id === selectedStepId) ?? steps[0];
  const activeIndex = active ? steps.findIndex((step) => step.id === active.id) : -1;
  const action = getPreviewAction(steps[activeIndex + 1], isBundle, t);

  useEffect(() => {
    if (selectedStepId && !steps.some((step) => step.id === selectedStepId)) {
      setSelectedStepId(steps[0]?.id ?? null);
    }
  }, [selectedStepId, steps]);

  return (
    <div className={styles.phone} aria-label={t('customer_preview_phone_label')}>
      <div className={styles.speaker} />
      <div className={styles.screen}>
        <div className={styles.status}>
          <span>9:41</span>
          <span>{t('customer_preview_title')}</span>
        </div>
        <div className={styles.header} dir="auto">
          {itemName}
        </div>
        <StepPreview
          active={active}
          index={activeIndex}
          total={steps.length}
          product={product}
          currentLanguage={currentLanguage}
          t={t}
        />
        <nav className={styles.navigation} aria-label={t('customer_preview_navigation')}>
          <button
            type="button"
            onClick={() => setSelectedStepId(steps[activeIndex - 1]?.id ?? null)}
            disabled={activeIndex <= 0}
          >
            <ChevronLeft size={15} aria-hidden="true" />
            {t('customer_preview_previous')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedStepId(steps[activeIndex + 1]?.id ?? null)}
            disabled={activeIndex < 0 || activeIndex >= steps.length - 1}
          >
            {t('customer_preview_next')}
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </nav>
        <footer className={styles.footer}>
          <span>{formatPlainCurrency(price)}</span>
          <button type="button" disabled aria-label={t('customer_preview_read_only_action', { action: action.name })}>
            {action.visual}
          </button>
        </footer>
      </div>
      <span className={styles.caption}>
        {t(isBundle ? 'customer_preview_bundle_caption' : 'customer_preview_item_caption')}
      </span>
    </div>
  );
}

function StepPreview({
  active,
  index,
  total,
  product,
  currentLanguage,
  t,
}: Readonly<{
  active?: CustomizationStep;
  index: number;
  total: number;
  product?: DetailedProduct;
  currentLanguage: string;
  t: Translate;
}>) {
  if (!active) {
    return (
      <main className={styles.content}>
        <h4>{t('customer_preview_empty')}</h4>
        <p className={styles.scope}>{t('customer_preview_read_only')}</p>
      </main>
    );
  }

  const choices = active.section
    ? active.section.items.slice(0, 3).map((item) => ({ key: item.id, name: item.productName ?? '' }))
    : previewChoices(active, product, currentLanguage)
        .slice(0, 3)
        .map((name, choiceIndex) => ({ key: `${active.id}:${choiceIndex}`, name }));

  return (
    <main className={styles.content}>
      <span className={styles.stepCount}>{t('customer_preview_step_count', { current: index + 1, total })}</span>
      <h4 dir="auto">{stepLabel(active, t)}</h4>
      {active.component?.productName && (
        <p className={styles.scope}>
          <BidiTemplate
            translationKey="customer_step_for_item"
            placeholder="item"
            value={active.component.productName}
          />
        </p>
      )}
      {active.section?.description && (
        <p className={styles.scope} dir="auto">
          {active.section.description}
        </p>
      )}
      {choices.length > 0 ? (
        <PreviewChoices choices={choices} />
      ) : (
        <p className={styles.scope}>{t('customer_preview_read_only')}</p>
      )}
    </main>
  );
}

function PreviewChoices({ choices }: Readonly<{ choices: readonly { key: string; name: string }[] }>) {
  return (
    <ul className={styles.choices}>
      {choices.map((choice) => (
        <li key={choice.key}>
          <span dir="auto">{choice.name}</span>
        </li>
      ))}
    </ul>
  );
}

function getPreviewAction(
  next: CustomizationStep | undefined,
  isBundle: boolean,
  t: Translate,
): { visual: ReactNode; name: string } {
  if (next?.kind === 'review') {
    const name = t(isBundle ? 'customer_cta_review_menu' : 'customer_cta_review_item');
    return { visual: name, name };
  }
  if (next) {
    const label = stepLabel(next, t);
    return {
      visual: <BidiTemplate translationKey="customer_cta_next_step" placeholder="step" value={label} />,
      name: t('customer_cta_next_step', { step: label }),
    };
  }
  const name = t('customer_cta_add_to_basket');
  return { visual: name, name };
}

function previewChoices(step: CustomizationStep, product: DetailedProduct | undefined, language: string): string[] {
  if (!step.component) return product ? previewProductChoices(step, product, language) : [];
  return previewComponentChoices(step, language);
}

function previewProductChoices(step: CustomizationStep, product: DetailedProduct, language: string): string[] {
  if (step.kind === 'variations')
    return product.variations
      .filter((row) => !step.variationIds?.length || step.variationIds.includes(row.id))
      .map((row) => localizedName(row, language));
  if (step.kind === 'group')
    return (step.groups ?? (step.group ? [step.group] : [])).map((group) => localizedName(group, language));
  if (step.kind === 'sides')
    return product.suggestedSideItems
      .filter((side) => !step.sideItemIds?.length || step.sideItemIds.includes(side.suggestedSideItemId ?? ''))
      .map((side) => localizedName(side, language));
  return (product.detailedIngredients ?? [])
    .filter((row) => !step.ingredientIds?.length || step.ingredientIds.includes(row.id))
    .map((row) => localizedName(row, language));
}

function previewComponentChoices(step: CustomizationStep, language: string): string[] {
  if (step.kind === 'variations') {
    return (step.component?.variations ?? [])
      .filter((row) => !step.variationIds?.length || step.variationIds.includes(row.id))
      .map((row) => localizedName(row, language));
  }
  if (step.kind === 'group')
    return (step.groups ?? (step.group ? [step.group] : [])).map((group) => localizedName(group, language));
  if (step.kind === 'sides') {
    return (step.component?.suggestedSideItems ?? [])
      .filter((side) => !step.sideItemIds?.length || step.sideItemIds.includes(side.id))
      .map((side) => side.sideItemProductName ?? '');
  }
  return (step.component?.detailedIngredients ?? [])
    .filter((row) => !step.ingredientIds?.length || step.ingredientIds.includes(row.id))
    .map((row) => localizedName(row, language));
}
