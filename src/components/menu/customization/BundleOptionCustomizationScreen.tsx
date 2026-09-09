'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';
import SheetStepProgress from './SheetStepProgress';
import SheetStepPanel from './SheetStepPanel';
import IngredientStepsBody from './IngredientStepsBody';
import SpecialRequestSection from './SpecialRequestSection';
import { stepLabel } from './stepLabel';
import type { BundleOptionFlow } from '@/hooks/menu/useBundleOptionFlow';
import styles from './BundleOptionCustomizationScreen.module.css';

/**
 * The per-option customization SCREEN inside the bundle sheet (the 2026-09 owner decision
 * superseding #175's inline drill-in). The guest taps Customize on a selected option and the sheet
 * navigates here — one guided step at a time, the SAME machinery the product flow runs:
 * `IngredientStepsBody` for the ingredient decisions (sauces as their own step, `variant='plain'`),
 * the special request as the last panel.
 *
 * The sheet's chrome (BaseModal) stays; only the body and the footer swap, so the live total in
 * the footer never stops being the bundle line's own. The header's back button — and Escape, and
 * the last step's Done — return to the bundle sheet with every selection made here intact, and
 * the progress rail's own back walks the option's steps.
 */
export default function BundleOptionCustomizationScreen({ flow }: Readonly<{ flow: BundleOptionFlow }>) {
  const { t } = useTranslation();
  const { item, option, step } = flow;
  if (!step) return null;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <button type="button" className={styles.back} onClick={flow.close} aria-label={t('back')}>
          {/* One glyph, mirrored by the stylesheet under [dir='rtl'] — the progress rail's rule. */}
          <ChevronLeft size={20} aria-hidden="true" />
          <span className={styles.headerName} dir="auto">
            {item.productName}
          </span>
        </button>
      </div>

      {flow.steps.length > 1 && (
        <SheetStepProgress
          steps={flow.steps}
          index={flow.index}
          furthest={flow.furthest}
          onJump={flow.goTo}
          onBack={flow.goBack}
        />
      )}

      <SheetStepPanel
        stepId={step.id}
        direction={flow.direction}
        title={stepLabel(step, t)}
        isRequired={step.isRequired}
        requiredLabel={t('required')}
        steady
      >
        {step.kind === 'special' ? (
          <SpecialRequestSection
            specialInstructions={option?.specialInstructions ?? ''}
            onInstructionsChange={flow.onInstructionsChange}
          />
        ) : (
          <IngredientStepsBody
            sauceGroup={item}
            ingredients={item.detailedIngredients ?? []}
            step={step}
            selectedIngredients={option?.selectedIngredients ?? []}
            ingredientQuantities={option?.ingredientQuantities ?? {}}
            onSelectionChange={flow.onSelectionChange}
            onQuantityChange={flow.onQuantityChange}
            onChoice={flow.advanceAfterChoice}
            currentLanguage={flow.currentLanguage}
          />
        )}
      </SheetStepPanel>
    </div>
  );
}
