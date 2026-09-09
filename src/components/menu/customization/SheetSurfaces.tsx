'use client';

import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import SheetIntro from './SheetIntro';
import SheetStepProgress from './SheetStepProgress';
import SheetStepPanel from './SheetStepPanel';
import SheetStepContent from './SheetStepContent';
import SheetFooter from './SheetFooter';
import SheetBlockedFooter from './SheetBlockedFooter';
import SpecialRequestSection from './SpecialRequestSection';
import { useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useSheetFlow } from '@/hooks/menu/useSheetFlow';
import { useBundleOptionFlow } from '@/hooks/menu/useBundleOptionFlow';
import { stepLabel, stepSkipLabel } from './stepLabel';
import type { DrinkUpsell } from '@/hooks/menu/useDrinkUpsell';
import type { SheetController } from '@/hooks/menu/useSheetFlow';
import type { OrderType } from '@/types/order';

/**
 * The surfaces the customization sheet is assembled from, extracted so the sheet itself stays
 * under the CLAUDE.md §4 file-length and sonar complexity ceilings: which action bar (the option
 * screen's Done, the blocked reason, or the step's verb), and the product flow's body.
 */
/** The intro payload, sourced by kind so a combo is not read off a null product detail. */
export function sheetIntro(controller: SheetController) {
  const detail = controller.kind === 'product' ? controller.product : null;
  return controller.kind === 'product'
    ? { allergens: detail?.allergens, preparationTimeMinutes: detail?.preparationTimeMinutes }
    : {
        allergens: controller.bundle?.allergens,
        preparationTimeMinutes: controller.bundle?.preparationTimeMinutes,
      };
}

/** Which action bar the sheet shows: the option screen's Done, the blocked reason, or the step verb. */
export function footerFor(args: {
  optionFooter: React.ReactElement | null;
  isBlocked: boolean;
  notice: ReturnType<typeof useItemAvailabilityNotice>;
  onSwitchOrderType: ((type: OrderType) => void) | undefined;
  styles: Record<string, string>;
  flow: ReturnType<typeof useSheetFlow>;
  step: ReturnType<typeof useSheetFlow>['step'];
  isSubmitting: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  addToCart: Parameters<ReturnType<typeof useSheetFlow>['addOrJumpToBlocker']>[0];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const {
    optionFooter,
    isBlocked,
    notice,
    onSwitchOrderType,
    styles,
    flow,
    step,
    isSubmitting,
    quantity,
    setQuantity,
    addToCart,
    t,
  } = args;
  return (
    optionFooter ??
    (isBlocked ? (
      <BlockedFooterBar
        notice={notice}
        onSwitchOrderType={onSwitchOrderType}
        styles={styles}
        onContinue={flow.isLast ? undefined : flow.goNext}
      />
    ) : (
      <StepFooterBar
        flow={flow}
        step={step}
        isSubmitting={isSubmitting}
        quantity={quantity}
        setQuantity={setQuantity}
        addToCart={addToCart}
        t={t}
      />
    ))
  );
}

/** Blocked: the whole action bar is replaced by the reason and the way out. */
function BlockedFooterBar({
  notice,
  onSwitchOrderType,
  styles,
  onContinue,
}: Readonly<{
  notice: ReturnType<typeof useItemAvailabilityNotice>;
  onSwitchOrderType: ((type: OrderType) => void) | undefined;
  styles: Record<string, string>;
  onContinue: (() => void) | undefined;
}>) {
  return (
    <SheetBlockedFooter notice={notice} onSwitchOrderType={onSwitchOrderType} styles={styles} onContinue={onContinue} />
  );
}

export function OptionFooterBar({
  optionFlow,
  t,
}: Readonly<{
  optionFlow: ReturnType<typeof useBundleOptionFlow>;
  t: ReturnType<typeof useTranslation>['t'];
}>) {
  if (!optionFlow) return null;
  return (
    <SheetFooter
      total={optionFlow.total}
      isLast={optionFlow.isLast}
      isSubmitting={false}
      quantity={1}
      setQuantity={() => undefined}
      onAdd={() => undefined}
      onConfirm={optionFlow.close}
      confirmLabel={t('done')}
      onContinue={optionFlow.goNext}
      isSkip={optionFlow.isSkip}
      skipLabel={stepSkipLabel(optionFlow.step, t)}
      blockedMessage={optionFlow.showBlocker ? t(`step_blocked_${optionFlow.blocker}`) : undefined}
    />
  );
}

/** The product branch's body: intro, guided progress + step panel, and the non-guided note. */
export function ProductFlowBody({
  controller,
  flow,
  step,
  isGuided,
  drinks,
  description,
  t,
  intro,
}: Readonly<{
  controller: SheetController;
  flow: ReturnType<typeof useSheetFlow>;
  step: ReturnType<typeof useSheetFlow>['step'];
  isGuided: boolean;
  drinks: DrinkUpsell | undefined;
  description?: string;
  t: ReturnType<typeof useTranslation>['t'];
  intro: Omit<ComponentProps<typeof SheetIntro>, 'description'>;
}>) {
  return (
    <>
      {/* No dish photo here, deliberately (MENU-DESIGN-CONFORMANCE-PLAN D8). The two
          `item_details_*` screens that show one are CRAFT designs, not classic, so they do not
          govern this surface; the lightbox already owns the photo from the card; and a hero would
          push the variations and the Add button below the fold at 390px. Settled — do not re-open. */}
      <SheetIntro
        description={description}
        allergens={intro.allergens}
        preparationTimeMinutes={intro.preparationTimeMinutes}
      />

      {isGuided && (
        <SheetStepProgress
          steps={flow.steps}
          index={flow.index}
          furthest={flow.furthest}
          onJump={flow.goTo}
          onBack={flow.goBack}
        />
      )}

      {step && (
        <SheetStepPanel
          stepId={step.id}
          direction={flow.direction}
          title={stepLabel(step, t)}
          isRequired={step.isRequired}
          requiredLabel={t('required')}
          steady={isGuided}
        >
          <SheetStepContent
            controller={controller}
            step={step}
            reviewRows={flow.reviewRows}
            onJump={flow.jumpToStep}
            onChoice={flow.advanceAfterChoice}
            drinks={drinks}
          />
        </SheetStepPanel>
      )}

      {/* Without a guided flow there is no review step to host it, and the note must not vanish
          for the simple items that are most of the catalogue. With one, it lives on the review
          step — asking for "no onions" before the guest has chosen anything is the wrong order. */}
      {!isGuided && (
        <SpecialRequestSection
          specialInstructions={controller.specialInstructions}
          onInstructionsChange={controller.setSpecialInstructions}
        />
      )}
    </>
  );
}

function StepFooterBar({
  flow,
  step,
  isSubmitting,
  quantity,
  setQuantity,
  addToCart,
  t,
}: Readonly<{
  flow: ReturnType<typeof useSheetFlow>;
  step: ReturnType<typeof useSheetFlow>['step'];
  isSubmitting: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  addToCart: Parameters<ReturnType<typeof useSheetFlow>['addOrJumpToBlocker']>[0];
  t: ReturnType<typeof useTranslation>['t'];
}>) {
  return (
    <SheetFooter
      total={flow.total}
      isLast={flow.isLast}
      isSubmitting={isSubmitting}
      quantity={quantity}
      setQuantity={setQuantity}
      onAdd={() => flow.addOrJumpToBlocker(addToCart)}
      onContinue={flow.goNext}
      isSkip={flow.isSkip}
      skipLabel={stepSkipLabel(step, t)}
      blockedMessage={flow.showBlocker ? t(`step_blocked_${flow.blocker}`) : undefined}
    />
  );
}
