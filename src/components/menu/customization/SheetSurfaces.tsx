'use client';

import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import SheetIntro from './SheetIntro';
import SheetStepProgress from './SheetStepProgress';
import SheetStepPanel from './SheetStepPanel';
import SheetStepContent from './SheetStepContent';
import SheetFooter from './SheetFooter';
import SheetBlockedFooter from './SheetBlockedFooter';
import SpecialRequestSection from './SpecialRequestSection';
import { SelectionRecoveryNotice } from './BundleSectionSelector';
import BidiTemplate from '@/components/common/BidiTemplate';
import { useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useSheetFlow } from '@/hooks/menu/useSheetFlow';
import { stepHint, stepLabel } from './stepLabel';
import type { DrinkUpsell } from '@/hooks/menu/useDrinkUpsell';
import type { SheetController } from '@/hooks/menu/useSheetFlow';
import type { OrderType } from '@/types/order';

/**
 * The surfaces the customization sheet is assembled from, extracted so the sheet itself stays
 * under the CLAUDE.md §4 file-length and sonar complexity ceilings: which action bar (the blocked
 * reason or the step's verb), and the product flow's body.
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

/** Which action bar the sheet shows: the blocked reason or the step verb. */
export function footerFor(args: {
  isBlocked: boolean;
  notice: ReturnType<typeof useItemAvailabilityNotice>;
  onSwitchOrderType: ((type: OrderType) => void) | undefined;
  styles: Record<string, string>;
  flow: ReturnType<typeof useSheetFlow>;
  isSubmitting: boolean;
  quantity: number;
  setQuantity: (quantity: number) => void;
  addToCart: Parameters<ReturnType<typeof useSheetFlow>['addOrJumpToBlocker']>[0];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const { isBlocked, notice, onSwitchOrderType, styles, flow, isSubmitting, quantity, setQuantity, addToCart, t } =
    args;
  const continueLabel = flow.isLast ? undefined : nextCustomerStepLabel(flow, t);
  return isBlocked ? (
    <BlockedFooterBar
      notice={notice}
      onSwitchOrderType={onSwitchOrderType}
      styles={styles}
      onContinue={flow.isLast ? undefined : flow.goNext}
      continueLabel={continueLabel}
    />
  ) : (
    <StepFooterBar
      flow={flow}
      isSubmitting={isSubmitting}
      quantity={quantity}
      setQuantity={setQuantity}
      addToCart={addToCart}
      t={t}
    />
  );
}

/** Blocked: the whole action bar is replaced by the reason and the way out. */
function BlockedFooterBar({
  notice,
  onSwitchOrderType,
  styles,
  onContinue,
  continueLabel,
}: Readonly<{
  notice: ReturnType<typeof useItemAvailabilityNotice>;
  onSwitchOrderType: ((type: OrderType) => void) | undefined;
  styles: Record<string, string>;
  onContinue: (() => void) | undefined;
  continueLabel: ReactNode;
}>) {
  return (
    <SheetBlockedFooter
      notice={notice}
      onSwitchOrderType={onSwitchOrderType}
      styles={styles}
      onContinue={onContinue}
      continueLabel={continueLabel}
    />
  );
}

function nextCustomerStepLabel(
  flow: ReturnType<typeof useSheetFlow>,
  t: ReturnType<typeof useTranslation>['t'],
): ReactNode {
  const nextStep = flow.steps[flow.index + 1];
  if (!nextStep) return null;
  if (nextStep.kind === 'review') {
    return t(flow.owner === 'menu' ? 'customer_cta_review_menu' : 'customer_cta_review_item');
  }
  return <BidiTemplate translationKey="customer_cta_next_step" placeholder="step" value={stepLabel(nextStep, t)} />;
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

      {controller.kind === 'bundle' &&
        flow.hasUnresolvedBundleOptions &&
        !flow.steps.some((entry) => entry.kind === 'section') && (
          <SelectionRecoveryNotice visible onClear={controller.clearUnresolvedOptions} />
        )}

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
          hint={
            step?.component?.productName ? (
              <BidiTemplate
                translationKey="customer_step_for_item"
                placeholder="item"
                value={step.component.productName}
              />
            ) : (
              stepHint(step, t)
            )
          }
          steady={isGuided}
        >
          <SheetStepContent
            controller={controller}
            step={step}
            reviewRows={flow.reviewRows}
            plannedSteps={flow.steps}
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
  isSubmitting,
  quantity,
  setQuantity,
  addToCart,
  t,
}: Readonly<{
  flow: ReturnType<typeof useSheetFlow>;
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
      continueLabel={nextCustomerStepLabel(flow, t)}
      blockedMessage={flow.showBlocker ? t(`step_blocked_${flow.blocker}`) : undefined}
    />
  );
}
