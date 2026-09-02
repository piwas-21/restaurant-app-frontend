'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSheetSteps } from './useSheetSteps';
import {
  buildBundleSteps,
  buildProductSteps,
  offersGenericDrinks,
  stepBlocker,
  type CustomizationStep,
} from '@/utils/customizationSteps';
import { bundleStepSummary, productStepSummary } from '@/utils/customizationSummary';
import { isSauce, toSauceGroupRule } from '@/utils/sauceGroup';
import type { ReviewRow } from '@/components/menu/customization/SheetReviewStep';
import type { ProductSheetController } from '@/components/menu/customization/ProductSheetBody';
import type { BundleSheetController } from '@/components/menu/customization/BundleSheetBody';
import type { DrinkUpsell } from './useDrinkUpsell';

export type SheetController = ProductSheetController | BundleSheetController;

/**
 * Layers the guided flow (MENU-CUSTOMIZATION-FLOW-PLAN §3) over whichever sheet controller is open.
 *
 * It lives ABOVE the two bodies rather than inside either, because the footer and the progress bar
 * are the sheet's chrome and a hook cannot be handed upward from a child. The controllers keep
 * every piece of selection state; this only derives the flow from it.
 *
 * Hooks run unconditionally on both branches — `controller.kind` may change between renders when a
 * product id turns out to be a combo — so both step lists are built every render and one is chosen.
 * They are cheap pure array builds over a payload already in memory.
 */
export function useSheetFlow(controller: SheetController, drinks?: DrinkUpsell) {
  const isBundle = controller.kind === 'bundle';
  const product = controller.kind === 'product' ? controller.product : null;
  const sections = controller.kind === 'bundle' ? controller.sections : EMPTY_SECTIONS;
  // Narrowed once, at the top. The union's fields are read in three places below and an inline
  // `controller.kind === …` in a dependency array is an expression ESLint cannot check statically.
  const selectedVariationId = controller.kind === 'product' ? controller.selectedVariationId : null;
  const selectedIngredients = controller.kind === 'product' ? controller.selectedIngredients : EMPTY_IDS;
  const selectedOptions = controller.kind === 'bundle' ? controller.selectedOptions : undefined;

  // A step only exists once there is something in it. Deriving it from "we asked for drinks" would
  // put an empty screen in the flow whenever the fetch fails or the tenant sells no beverages.
  const hasDrinks = (drinks?.drinks.length ?? 0) > 0;

  // …and it is decided ONCE, when the sheet opens on this item. The beverage list arrives on a
  // network round trip; letting it change the step list mid-view slides a new step in underneath
  // the guest, so the panel they are reading swaps content and the priced Add they were about to
  // press becomes Continue.
  const hasDrinksRef = useRef(hasDrinks);
  hasDrinksRef.current = hasDrinks;
  const [drinksAtOpen, setDrinksAtOpen] = useState(hasDrinks);
  const withDrinks = drinksAtOpen && product !== null && offersGenericDrinks(product);

  const steps = useMemo(() => {
    if (isBundle) return buildBundleSteps(sections);
    return product ? buildProductSteps(product, withDrinks) : [];
  }, [isBundle, sections, product, withDrinks]);

  // The sauce gate's two inputs. Read off the PRODUCT's own rule, which is the same carrier
  // `SauceGroupSection` prices from — a second reading here is how a step comes to gate on a
  // minimum the group itself does not enforce.
  const sauceRule = useMemo(() => toSauceGroupRule(product), [product]);
  const sauceIds = useMemo(
    () =>
      (product?.detailedIngredients ?? [])
        .filter((ingredient) => ingredient.isActive && ingredient.isOptional && isSauce(ingredient))
        .map((ingredient) => ingredient.id),
    [product],
  );

  // The fields rather than the controller object: the controller is a fresh identity every render,
  // so depending on it would rebuild the gate on every keystroke in the special-request box.
  const gate = useMemo(
    () => ({ selectedVariationId, selectedIngredients, selectedOptions }),
    [selectedVariationId, selectedIngredients, selectedOptions],
  );

  // A drink chosen for the last dish must not ride along with the next one.
  const resetDrinks = drinks?.reset;
  const itemId = product?.id ?? (controller.kind === 'bundle' ? controller.bundle?.id : undefined) ?? '';
  useEffect(() => {
    setDrinksAtOpen(hasDrinksRef.current);
    resetDrinks?.();
  }, [itemId, resetDrinks]);

  const flow = useSheetSteps({
    steps,
    gate,
    sauceMin: sauceRule.min,
    sauceIds,
    // The item, not the sheet: reopening on a different dish must start at step one, and a
    // controller's own state has already been reseeded by then.
    resetKey: itemId,
  });

  const drinkSummary = drinks?.summary;

  /** Every content step with what the guest chose — see `customizationSummary` for the None rule. */
  const reviewRows: ReviewRow[] = useMemo(() => {
    const contentSteps = steps.filter((step) => step.kind !== 'review');

    const drinkValues = (step: CustomizationStep) =>
      step.kind === 'drinks' ? (drinkSummary?.(controller.currentLanguage) ?? []) : null;

    if (controller.kind === 'bundle') {
      return contentSteps.map((step) => ({
        step,
        values: drinkValues(step) ?? (step.section ? bundleStepSummary(step.section, controller.selectedOptions) : []),
      }));
    }

    if (!controller.product) return [];
    const detail = controller.product;
    const state = {
      selectedVariationId: controller.selectedVariationId,
      selectedIngredients: controller.selectedIngredients,
      ingredientQuantities: controller.ingredientQuantities,
      selectedSideItems: controller.selectedSideItems,
    };
    return contentSteps.map((step) => ({
      step,
      values: drinkValues(step) ?? productStepSummary(step, detail, state, controller.currentLanguage),
    }));
  }, [steps, controller, drinkSummary]);

  const jumpToStep = useCallback(
    (target: CustomizationStep) => {
      const index = steps.findIndex((step) => step.id === target.id);
      if (index >= 0) flow.goTo(index);
    },
    [steps, flow],
  );

  /**
   * Commit, or send the guest to the first thing standing in the way.
   *
   * Without this the review step's **Add** is a dead control: the bundle controller refuses an
   * invalid selection with `setShowValidation(true); return;`, and the only place that error is
   * rendered is the offending SECTION's own step — which is not on screen. The guest presses a
   * priced button and nothing happens at all. The gate is the same `stepBlocker` the flow already
   * enforces on Continue, so the two can never disagree about what is missing.
   */
  const addOrJumpToBlocker = useCallback(
    (commit: () => void) => {
      const blockedIndex = steps.findIndex(
        (candidate) => stepBlocker(candidate, gate, sauceRule.min, sauceIds) !== null,
      );
      if (blockedIndex < 0) {
        commit();
        return;
      }
      flow.goTo(blockedIndex);
      flow.revealBlocker();
    },
    [steps, gate, sauceRule.min, sauceIds, flow],
  );

  /**
   * Whether the current step is one the guest may walk past having chosen nothing — which is what
   * makes the footer say **Skip** instead of Continue. Naming the action honestly is the point:
   * "Continue" on an untouched optional step implies something was answered.
   */
  const isSkip = useMemo(() => {
    if (!flow.step || flow.step.isRequired || flow.isLast) return false;
    const row = reviewRows.find((candidate) => candidate.step.id === flow.step?.id);
    return row ? row.values.length === 0 : false;
  }, [flow.step, flow.isLast, reviewRows]);

  /**
   * What the footer shows. `linePrice` stays the line's own authority — the drinks are separate
   * basket lines and never enter it — but the guest is about to be charged for both, so the button
   * has to name the sum they will actually pay.
   */
  const total = controller.linePrice.total + (drinks?.subtotal ?? 0);

  return { ...flow, reviewRows, jumpToStep, addOrJumpToBlocker, isSkip, total };
}

const EMPTY_SECTIONS: never[] = [];
const EMPTY_IDS: string[] = [];
