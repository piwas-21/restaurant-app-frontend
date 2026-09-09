'use client';

import React from 'react';
import OptionalIngredientsSection from './OptionalIngredientsSection';
import SpecialRequestSection from './SpecialRequestSection';
import type { MenuSectionItem, SelectedMenuOption } from '@/types/menu';
import styles from './BundleOptionInlinePanel.module.css';

interface BundleOptionInlinePanelProps {
  /** Anchor for the Customize button's `aria-controls` on the staff modal. */
  id?: string;
  item: MenuSectionItem;
  /** The live selection state — present only while this option is selected. */
  option?: SelectedMenuOption;
  currentLanguage: string;
  onSelectionChange: (selected: string[]) => void;
  onQuantityChange: (ingredientId: string, quantity: number) => void;
  onInstructionsChange: (instructions: string) => void;
}

/**
 * A bundle option's ingredient + special-request editing, expanded INLINE under its row.
 *
 * This used to live inside `BundleOptionRow` and serve the guest sheet (the #175 redesign's
 * drill-in). The 2026-09 owner decision replaced that with the guided per-option screen
 * (`BundleOptionCustomizationScreen`, same step machinery as the product flow), so this panel now
 * has exactly one consumer: `WaiterBundleCustomization`, the staff modal, where expanding in place
 * is the efficient shape for a counter order. Sauces render expanded (`plain`), exactly as the
 * guided flow's own sauces step does — the partner parity ask (mcdoner) that outlived the panel's
 * move.
 */
export default function BundleOptionInlinePanel({
  id,
  item,
  option,
  currentLanguage,
  onSelectionChange,
  onQuantityChange,
  onInstructionsChange,
}: Readonly<BundleOptionInlinePanelProps>) {
  const ingredients = item.detailedIngredients ?? [];

  return (
    <div className={styles.panel} id={id}>
      <OptionalIngredientsSection
        ingredients={ingredients}
        selectedIngredients={option?.selectedIngredients ?? []}
        ingredientQuantities={option?.ingredientQuantities ?? {}}
        onSelectionChange={onSelectionChange}
        onQuantityChange={onQuantityChange}
        currentLanguage={currentLanguage}
        sauceGroup={item}
        sauceVariant="plain"
      />
      <SpecialRequestSection
        specialInstructions={option?.specialInstructions ?? ''}
        onInstructionsChange={onInstructionsChange}
      />
    </div>
  );
}
