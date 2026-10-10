'use client';

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReviewRow } from '@/components/menu/customization/SheetReviewStep';
import type { CustomizationStep } from '@/utils/customizationSteps';
import { bundleStepSummary, productStepSummary } from '@/utils/customizationSummary';
import { bundleComponentStepSummary } from '@/utils/bundleComponentSummary';
import { resolveBundleOptionSelections } from '@/utils/bundleOptionResolution';
import type { SheetController } from './useSheetFlow';

interface UseReviewRowsArgs {
  controller: SheetController;
  steps: readonly CustomizationStep[];
  /** The drinks upsell's own summary — the drinks step's rows come from it, not the line. */
  drinkSummary?: (language: string) => string[];
}

/**
 * Every content step with what the guest chose — see `customizationSummary` for the None rule.
 * Extracted from `useSheetFlow` to keep it under the §4 hook limit; the narrowing by controller
 * kind moved with it, so `useSheetFlow` stays a flow driver rather than a summary builder.
 */
export function useReviewRows({ controller, steps, drinkSummary }: UseReviewRowsArgs): ReviewRow[] {
  const { t } = useTranslation();
  return useMemo(() => {
    const contentSteps = steps.filter((step) => step.kind !== 'review');

    const drinkValues = (step: CustomizationStep) =>
      step.kind === 'drinks' ? (drinkSummary?.(controller.currentLanguage) ?? []) : null;

    if (controller.kind === 'bundle') {
      const canonicalOptions = resolveBundleOptionSelections(controller.sections, controller.selectedOptions).flatMap(
        (entry) => (entry.status === 'resolved' && entry.canonicalSelection ? [entry.canonicalSelection] : []),
      );
      return contentSteps.map((step) => ({
        step,
        values:
          drinkValues(step) ??
          (step.section
            ? bundleStepSummary(step.section, controller.selectedOptions)
            : bundleComponentStepSummary(step, canonicalOptions, controller.currentLanguage, t('sauce_none'))),
        ...(step.selectionRecovery ? { warning: t('customer_selection_recover') } : {}),
      }));
    }

    if (!controller.product) return [];
    const detail = controller.product;
    const state = {
      selectedVariationId: controller.selectedVariationId,
      selectedIngredients: controller.selectedIngredients,
      ingredientQuantities: controller.ingredientQuantities,
      selectedSideItems: controller.selectedSideItems,
      customizationSelections: controller.customizationSelections,
    };
    return contentSteps.map((step) => ({
      step,
      values: drinkValues(step) ?? productStepSummary(step, detail, state, controller.currentLanguage),
    }));
  }, [steps, controller, drinkSummary, t]);
}
