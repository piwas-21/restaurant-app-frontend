'use client';

import React from 'react';
import BundleSectionSelector from './BundleSectionSelector';
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
 * options and each option carrying a nested "Customize" disclosure, all stacked in one column.
 */
export default function BundleSheetBody({ controller, step, onChoice }: Readonly<BundleSheetBodyProps>) {
  const {
    selectedOptions,
    visibleErrors,
    expandedOptionKey,
    currentLanguage,
    toggleOption,
    toggleOptionExpanded,
    setOptionCustomization,
  } = controller;

  const section = step.section;
  if (!section) return null;

  const minSelectionError = visibleErrors.find((error) => error.sectionId === section.id)?.minSelection;

  return (
    <BundleSectionSelector
      section={section}
      selectedOptions={selectedOptions}
      minSelectionError={minSelectionError}
      expandedOptionKey={expandedOptionKey}
      currentLanguage={currentLanguage}
      onToggleOption={(toggledSection, itemId) => {
        toggleOption(toggledSection, itemId);
        // …but NOT when the option the guest just picked has ingredients of its own. Its
        // "Customize" disclosure appears only once the option is selected, so advancing 260 ms
        // later slides the panel away before the guest can ever open it.
        if (!hasOwnCustomization(section, itemId)) onChoice();
      }}
      onToggleExpanded={toggleOptionExpanded}
      onCustomizationChange={setOptionCustomization}
      hideLegend
    />
  );
}

/** Does picking this option open a drill-in the guest would be carried past? */
function hasOwnCustomization(section: MenuSection, productId: string): boolean {
  const item = section.items.find((candidate) => candidate.productId === productId);
  return (item?.detailedIngredients?.length ?? 0) > 0;
}
