'use client';

import React from 'react';
import BundleSectionSelector from './BundleSectionSelector';
import { findBundleOption } from '@/utils/bundleSelection';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';
import type { MenuSection } from '@/types/menu';

export type BundleSheetController = ReturnType<typeof useBundleCustomizationSheet>;

interface BundleSheetBodyProps {
  controller: BundleSheetController;
  /** The step on screen — one menu section. The flow decides which. */
  step: CustomizationStep;
  /** Announces that a single-choice section has been answered, so the flow may advance itself. */
  onChoice: () => void;
}

/**
 * The bundle body of `ItemCustomizationSheet` — one menu section at a time
 * (MENU-CUSTOMIZATION-FLOW-PLAN §3).
 *
 * A combo is the case the old single-scroll layout hurt most: four sections, each with its own
 * options and each option carrying a nested "Customize" drill-in, all stacked in one column.
 * Customizing an option now leaves this body entirely — the sheet hosts the option's guided
 * screen (the 2026-09 owner decision superseding #175's inline drill-in), and since partner
 * feedback 2026-09 the sheet walks into that screen BY ITSELF: a picked option with ingredients
 * opens its screens on the pick (single-choice) or when the section is Continued (multi-select).
 * The row's Customize affordance remains as the way back INTO a visited option, not the way in.
 */
export default function BundleSheetBody({ controller, step, onChoice }: Readonly<BundleSheetBodyProps>) {
  const { selectedOptions, visibleErrors, currentLanguage, toggleOption, openOptionCustomization, beginOptionTourAt } =
    controller;

  const section = step.section;
  if (!section) return null;

  const minSelectionError = visibleErrors.find((error) => error.sectionId === section.id)?.minSelection;

  return (
    <BundleSectionSelector
      section={section}
      selectedOptions={selectedOptions}
      minSelectionError={minSelectionError}
      currentLanguage={currentLanguage}
      onToggleOption={(toggledSection, itemId) => {
        // A no-op toggle (re-picking the selected radio) neither advances nor re-opens anything:
        // the guest is already where the pick puts them.
        const wasSelected = Boolean(findBundleOption(selectedOptions, toggledSection.id, itemId));
        toggleOption(toggledSection, itemId);
        if (wasSelected) return;
        // Partner feedback 2026-09: picking an option that has ingredients/sauces IS the
        // navigation — the sheet advances straight into its guided screens, no Customize tap. On
        // a single-choice section that happens the moment the row is picked; a multi-select
        // section keeps the guest on the rows (they may pick several) and the walk starts when
        // they Continue. An option with nothing further to configure announces the choice, and
        // the section auto-advances as before.
        if (hasOwnCustomization(toggledSection, itemId)) {
          if (toggledSection.maxSelection === 1) beginOptionTourAt(toggledSection.id, itemId);
          return;
        }
        onChoice();
      }}
      onCustomizeOption={openOptionCustomization}
      hideLegend
    />
  );
}

/** Does picking this option open a customization screen the guest would be carried past? */
function hasOwnCustomization(section: MenuSection, productId: string): boolean {
  const item = section.items.find((candidate) => candidate.productId === productId);
  return (item?.detailedIngredients?.length ?? 0) > 0;
}
