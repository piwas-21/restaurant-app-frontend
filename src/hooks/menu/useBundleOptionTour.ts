'use client';

import { useCallback, useState } from 'react';
import { findBundleOption } from '@/utils/bundleSelection';
import type { MenuSection, MenuSectionItem, SelectedMenuOption } from '@/types/menu';

/** The outcome of Done on the option screen's last step — see `advance`. */
export type OptionTourOutcome = 'advanced' | 'done' | 'review';

interface UseBundleOptionTourArgs {
  sections: readonly MenuSection[];
  selectedOptions: readonly SelectedMenuOption[];
}

/**
 * Which option's guided customization screen is open, and whether it is part of a GUIDED walk
 * (partner feedback 2026-09): picking an option that has ingredients/sauces advances straight
 * into its screens — no Customize tap. A single-choice section opens the screens on the pick
 * (`beginAt`); a multi-select section walks its picked options in section order once the guest
 * Continues (`begin`), each Done opening the next. The row's Customize affordance stays as the
 * way BACK into a visited option (`openForReview`), where Done returns to the section rather
 * than pushing on — the walk and the review differ only in that `tourSectionId`.
 *
 * Stops are the section's SELECTED items that carry their own `detailedIngredients` — the same
 * rule that shows the Customize affordance. Extracted from `useBundleCustomizationSheet` to
 * keep both under the §4 hook limit.
 */
export function useBundleOptionTour({ sections, selectedOptions }: UseBundleOptionTourArgs) {
  /** The option whose guided customization screen is open (the 2026-09 override of #175's inline
   * drill-in). Keyed by section+item, resolved by the sheet against the payload. */
  const [customizingOption, setCustomizingOption] = useState<{ sectionId: string; itemId: string } | null>(null);
  /** The section being walked as a guided tour. Null on a review visit. */
  const [tourSectionId, setTourSectionId] = useState<string | null>(null);

  /** The option carries ingredients/sauces of its own — what makes it a walk stop. */
  const optionHasCustomization = (item: MenuSectionItem): boolean => (item.detailedIngredients?.length ?? 0) > 0;

  const close = useCallback(() => {
    setCustomizingOption(null);
    setTourSectionId(null);
  }, []);

  /** REVIEW entry — the row's Customize affordance. Done returns to the section, no walk. */
  const openForReview = useCallback((sectionId: string, itemId: string) => {
    setCustomizingOption({ sectionId, itemId });
    setTourSectionId(null);
  }, []);

  /** GUIDED entry for a fresh RADIO pick — the pick IS the navigation. */
  const beginAt = useCallback((sectionId: string, itemId: string) => {
    setCustomizingOption({ sectionId, itemId });
    setTourSectionId(sectionId);
  }, []);

  /**
   * GUIDED entry for a finished MULTI-SELECT (or fixed Plat) section — starts the walk at the
   * FIRST selected option in section order that carries its own ingredients/sauces. False when
   * there is nothing to walk (the caller advances normally).
   */
  const begin = useCallback(
    (section: MenuSection): boolean => {
      const first = section.items.find(
        (item) => optionHasCustomization(item) && findBundleOption(selectedOptions, section.id, item.productId),
      );
      if (!first) return false;
      setCustomizingOption({ sectionId: section.id, itemId: first.productId });
      setTourSectionId(section.id);
      return true;
    },
    [selectedOptions],
  );

  /**
   * Done on the option screen. In a guided walk it opens the NEXT selected option with its own
   * customization (section order); `'done'` ends the walk — the caller advances the SECTION flow
   * past the answered section. A review entry has nothing to walk: `'review'` asks the caller to
   * simply close, landing back on the section step.
   */
  const advance = useCallback((): OptionTourOutcome => {
    if (!tourSectionId) return 'review';
    const section = sections.find((candidate) => candidate.id === tourSectionId);
    if (!section || !customizingOption) {
      close();
      return 'done';
    }
    const walkedIndex = section.items.findIndex((item) => item.productId === customizingOption.itemId);
    const next = section.items
      .slice(walkedIndex + 1)
      .find((item) => optionHasCustomization(item) && findBundleOption(selectedOptions, section.id, item.productId));
    if (!next) {
      close();
      return 'done';
    }
    setCustomizingOption({ sectionId: section.id, itemId: next.productId });
    return 'advanced';
  }, [tourSectionId, sections, customizingOption, selectedOptions, close]);

  /** A fresh sheet (or a closed one) starts with no screen up and no walk in progress. */
  const reset = close;

  /** The sheet's toggle: deselecting the option on screen (or in a walked section) kills the walk. */
  const handleDeselection = useCallback((sectionId: string, itemId: string) => {
    setCustomizingOption((prev) => (prev?.sectionId === sectionId && prev.itemId === itemId ? null : prev));
    setTourSectionId((prev) => (prev === sectionId ? null : prev));
  }, []);

  return {
    customizingOption,
    tourSectionId,
    openForReview,
    beginAt,
    begin,
    advance,
    close,
    reset,
    handleDeselection,
  };
}

export type BundleOptionTour = ReturnType<typeof useBundleOptionTour>;
