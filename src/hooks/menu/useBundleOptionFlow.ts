'use client';

import { useCallback, useMemo } from 'react';
import { useSheetSteps } from './useSheetSteps';
import { buildOptionSteps } from '@/utils/customizationSteps';
import { optionStepIsSkippable } from '@/utils/customizationSummary';
import { findBundleOption } from '@/utils/bundleSelection';
import { isSauce, toSauceGroupRule } from '@/utils/sauceGroup';
import type { SheetController } from './useSheetFlow';
import type { SelectedMenuOption } from '@/types/menu';

/**
 * The guided flow of ONE selected bundle option — the per-option customization screen the bundle
 * sheet navigates to (the 2026-09 owner decision superseding #175's inline drill-in).
 *
 * It is `useSheetFlow` narrowed to an option: the same `useSheetSteps` driver over the same
 * `buildOptionSteps` derivation, gated by the same sauce rule the OPTION carries (the option IS
 * that product, S6). The selection it edits lives where it always has — inside the bundle line's
 * `selectedOptions` — so leaving the screen cannot lose it, and the bundle total prices every
 * keystroke live.
 *
 * Returns `null` unless the controller is a bundle with an option screen up, which is what lets
 * `ItemCustomizationSheet` swap body and footer with one ternary. Hooks run unconditionally on
 * both branches — `controller.kind` may change between renders when a product id turns out to be
 * a combo — so the derivations below are cheap no-ops on the product branch.
 */
export function useBundleOptionFlow(controller: SheetController, total: number) {
  const isBundle = controller.kind === 'bundle';
  const bundle = isBundle ? controller : null;
  const customizing = bundle?.customizingOption ?? null;
  const sections = bundle?.sections ?? EMPTY_SECTIONS;

  const item = useMemo(() => {
    if (!customizing) return null;
    return sections
      .find((section) => section.id === customizing.sectionId)
      ?.items.find((candidate) => candidate.productId === customizing.itemId);
  }, [customizing, sections]);

  const option = useMemo(
    () =>
      item && customizing && bundle
        ? findBundleOption(bundle.selectedOptions, customizing.sectionId, customizing.itemId)
        : undefined,
    [item, customizing, bundle],
  );

  const steps = useMemo(() => (item ? buildOptionSteps(item) : []), [item]);
  const sauceRule = useMemo(() => toSauceGroupRule(item), [item]);
  const sauceIds = useMemo(
    () =>
      (item?.detailedIngredients ?? [])
        .filter((ingredient) => ingredient.isActive && ingredient.isOptional && isSauce(ingredient))
        .map((ingredient) => ingredient.id),
    [item],
  );

  const selectedIngredients = option?.selectedIngredients ?? EMPTY_IDS;
  const currentLanguage = bundle?.currentLanguage ?? 'en';
  const gate = useMemo(() => ({ selectedVariationId: null, selectedIngredients }), [selectedIngredients]);

  const flow = useSheetSteps({
    steps,
    gate,
    sauceMin: sauceRule.min,
    sauceIds,
    // The OPTION, not the sheet: moving from one option's screen to another must start at step one.
    resetKey: customizing ? `${customizing.sectionId}::${customizing.itemId}` : '',
  });

  /**
   * The footer's honest verb: Skip where walking past keeps nothing, the named "no sauce" answer
   * on the sauces step — `optionStepIsSkippable`, the per-option narrowing of `stepIsSkippable`.
   */
  const isSkip = useMemo(
    () =>
      Boolean(
        flow.step &&
        !flow.step.isRequired &&
        !flow.isLast &&
        optionStepIsSkippable(flow.step, item?.detailedIngredients ?? [], selectedIngredients, sauceIds, sauceRule),
      ),
    [flow.step, flow.isLast, item, selectedIngredients, sauceIds, sauceRule],
  );

  const patch = useCallback(
    (p: Partial<SelectedMenuOption>) => {
      if (!customizing || !bundle) return;
      bundle.setOptionCustomization(customizing.sectionId, customizing.itemId, p);
    },
    [customizing, bundle],
  );

  const onSelectionChange = useCallback((selected: string[]) => patch({ selectedIngredients: selected }), [patch]);
  const onQuantityChange = useCallback(
    (ingredientId: string, quantity: number) => patch({ ingredientQuantities: { [ingredientId]: quantity } }),
    [patch],
  );
  const onInstructionsChange = useCallback(
    (instructions: string) => patch({ specialInstructions: instructions || undefined }),
    [patch],
  );

  if (!bundle || !item || !customizing) return null;

  return {
    ...flow,
    sectionId: customizing.sectionId,
    itemId: customizing.itemId,
    item,
    option,
    currentLanguage,
    isSkip,
    total,
    onSelectionChange,
    onQuantityChange,
    onInstructionsChange,
    /** The way back to the bundle sheet — the header's back button, the last step's Done, Escape. */
    close: bundle.closeOptionCustomization,
  };
}

export type BundleOptionFlow = NonNullable<ReturnType<typeof useBundleOptionFlow>>;

const EMPTY_SECTIONS: never[] = [];
const EMPTY_IDS: string[] = [];
