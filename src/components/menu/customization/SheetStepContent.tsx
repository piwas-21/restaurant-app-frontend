'use client';

import React from 'react';
import ProductSheetBody from './ProductSheetBody';
import BundleSheetBody from './BundleSheetBody';
import SheetReviewStep, { type ReviewRow } from './SheetReviewStep';
import DrinksStep from './DrinksStep';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { SheetController } from '@/hooks/menu/useSheetFlow';
import type { DrinkUpsell } from '@/hooks/menu/useDrinkUpsell';

interface SheetStepContentProps {
  controller: SheetController;
  step: CustomizationStep;
  reviewRows: readonly ReviewRow[];
  onJump: (step: CustomizationStep) => void;
  onChoice: () => void;
  /** Present whenever a drinks step is in the flow — `useSheetFlow` derives one only if it is. */
  drinks?: DrinkUpsell;
}

/**
 * Routes one step to the body that renders it. Three cases and nothing else — extracted from
 * `ItemCustomizationSheet` so that shell keeps its own branching (open, blocked, guided) legible
 * rather than nesting a second dispatch inside it.
 *
 * The review step is shared by both kinds on purpose: its rows already come from the flow, which
 * built them from whichever controller is open, so neither body needs to know the other exists.
 */
export default function SheetStepContent({
  controller,
  step,
  reviewRows,
  onJump,
  onChoice,
  drinks,
}: Readonly<SheetStepContentProps>) {
  if (step.kind === 'review') {
    return (
      <SheetReviewStep
        rows={reviewRows}
        onJump={onJump}
        specialInstructions={controller.specialInstructions}
        onInstructionsChange={controller.setSpecialInstructions}
      />
    );
  }

  if (step.kind === 'drinks') {
    return drinks ? <DrinksStep drinks={drinks} currentLanguage={controller.currentLanguage} /> : null;
  }

  if (controller.kind === 'bundle') {
    return <BundleSheetBody controller={controller} step={step} onChoice={onChoice} />;
  }

  return <ProductSheetBody controller={controller} step={step} onChoice={onChoice} />;
}
