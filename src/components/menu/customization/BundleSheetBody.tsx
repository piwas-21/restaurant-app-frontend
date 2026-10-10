'use client';

import React from 'react';
import BundleSectionSelector from './BundleSectionSelector';
import { resolveBundleRowSelection } from '@/utils/bundleOptionResolution';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';

export type BundleSheetController = ReturnType<typeof useBundleCustomizationSheet>;

interface BundleSheetBodyProps {
  controller: BundleSheetController;
  /** The step on screen — one menu section. The flow decides which. */
  step: CustomizationStep;
  /** Announces that a single-choice section has been answered, so the flow may advance itself. */
  onChoice: () => void;
  /** The planned component screens make Customize a jump within this same ordered flow. */
  plannedSteps: readonly CustomizationStep[];
  onJump: (step: CustomizationStep) => void;
}

/**
 * The bundle body of `ItemCustomizationSheet` — one menu section at a time
 * (MENU-CUSTOMIZATION-FLOW-PLAN §3).
 *
 * A combo's selected-component screens join the same ordered flow as its menu sections. A single
 * choice advances into its next planned screen; a multi-choice section waits for Continue. The
 * row's Customize action jumps back to that component's first planned screen.
 */
export default function BundleSheetBody({
  controller,
  step,
  onChoice,
  plannedSteps,
  onJump,
}: Readonly<BundleSheetBodyProps>) {
  const { selectedOptions, visibleErrors, currentLanguage, toggleOption } = controller;

  const section = step.section;
  if (!section) return null;
  const minSelectionError = visibleErrors.find((error) => error.sectionId === section.id)?.minSelection;

  return (
    <BundleSectionSelector
      section={section}
      selectedOptions={selectedOptions}
      minSelectionError={minSelectionError}
      selectionRecovery={step.selectionRecovery}
      onClearUnresolved={controller.clearUnresolvedOptions}
      currentLanguage={currentLanguage}
      onToggleOption={(toggledSection, itemId, productVariationId, menuSectionItemId) => {
        // A no-op toggle (re-picking the selected radio) neither advances nor re-opens anything:
        // the guest is already where the pick puts them.
        const target = toggledSection.items.find((item) => item.id === menuSectionItemId);
        const rowSelection = target ? resolveBundleRowSelection(toggledSection, selectedOptions, target) : undefined;
        const wasSelected = Boolean(rowSelection?.selection);
        toggleOption(toggledSection, itemId, productVariationId, menuSectionItemId);
        if (wasSelected) return;
        if (toggledSection.maxSelection === 1 && (rowSelection?.unresolvedCount ?? 0) <= 1) onChoice();
      }}
      onCustomizeOption={(_sectionId, _itemId, _productVariationId, menuSectionItemId) => {
        const plannedStep = plannedSteps.find(
          (candidate) => candidate.sectionItemId === menuSectionItemId && candidate.parentStepId === step.id,
        );
        if (plannedStep) onJump(plannedStep);
      }}
      onOptionQuantityChange={(sectionId, itemId, quantity, productVariationId, menuSectionItemId) =>
        controller.setOptionCustomization(sectionId, itemId, { quantity }, productVariationId, menuSectionItemId)
      }
      hideLegend
    />
  );
}
