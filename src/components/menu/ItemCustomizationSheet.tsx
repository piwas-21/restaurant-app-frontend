'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import BundleOptionCustomizationScreen from '@/components/menu/customization/BundleOptionCustomizationScreen';
import { useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import { useSheetFlow, type SheetController } from '@/hooks/menu/useSheetFlow';
import { useBundleOptionFlow } from '@/hooks/menu/useBundleOptionFlow';
import type { DrinkUpsell } from '@/hooks/menu/useDrinkUpsell';
import { footerFor, sheetIntro, OptionFooterBar, ProductFlowBody } from '@/components/menu/customization/SheetSurfaces';
import type { OrderType } from '@/types/order';
import styles from './ItemCustomizationSheet.module.css';

export type { SheetController };

interface ItemCustomizationSheetProps {
  controller: SheetController;
  /**
   * Commit a different order type from the blocked-state switch. Same instance the cards use — the
   * page's `useOrderTypeFollowUp().pickType`, so the follow-up modal actually opens.
   */
  onSwitchOrderType?: (type: OrderType) => void;
  /**
   * The page's shared drinks upsell (§3.4). Passed as a prop rather than carried on the controller:
   * it never enters `useLinePrice`, and it produces its own basket lines rather than customizing
   * this one — so it is the sheet's chrome, not the line's state.
   */
  drinks?: DrinkUpsell;
}

/**
 * The single customer customization surface — a `BaseModal` holding the guided flow
 * (MENU-CUSTOMIZATION-FLOW-PLAN). One chrome (title, item context, progress bar, live-priced
 * footer) over a body that varies by `controller.kind`; both controllers price through the same
 * backend-faithful `useLinePrice`, so a product line and a bundle line can never drift apart.
 *
 * **The flow is conditional.** An item with one decision renders that decision and an Add button —
 * no progress bar, no Continue, no review — because a wizard around a single size picker is pure
 * friction. Everything below keys off `flow.steps.length`, which is what makes that true.
 */
export default function ItemCustomizationSheet({
  controller,
  onSwitchOrderType,
  drinks,
}: Readonly<ItemCustomizationSheetProps>) {
  const { t } = useTranslation();
  const { isOpen, title, description, quantity, setQuantity, isSubmitting, addToCart, close } = controller;
  const flow = useSheetFlow(controller, drinks);
  // The per-option screen the bundle sheet navigates to (Customize on a selected option), or null
  // when the sheet is on its own flow. While it is up, BOTH the body and the footer below are the
  // option's — the bundle's steps stay exactly where the guest left them.
  const optionFlow = useBundleOptionFlow(controller, flow.total);

  // Taking the way out ends the option screen first: the line being edited is still in the bundle
  // controller, so backing out must not throw it away with the sheet.
  const dismiss = optionFlow ? optionFlow.close : close;

  // Narrowed once — the product branch's fields are read four times below.
  const detail = controller.kind === 'product' ? controller.product : null;

  // The verdict the browse card resolved, handed over on open (§9.10). A product carries it in via
  // `OpenSheetOptions`; a combo carries its own, because the bundle the sheet opens on IS the browse
  // row (no re-fetch, so no second resolution that could disagree). Since §9.2 both are real
  // verdicts — before it, a blocked combo reached this footer with nothing to say and offered Add.
  const availability = controller.kind === 'product' ? detail?.availability : controller.bundle?.availability;
  const notice = useItemAvailabilityNotice(availability);

  // Sourced by kind for the same reason `availability` is. `detail` is null on the bundle branch,
  // so reading these off it showed a combo NO allergens and no prep time — and once the card
  // started rendering the chips (#702), the guest who taps in to read the labelling gets a blank
  // panel, which is worse than the card having said nothing.
  const intro = sheetIntro(controller);

  // The SERVER's verdict is the gate, not our ability to render a nice reason for it. The notice is
  // null while the admin-enabled channel list is still in flight, and gating on it alone reopened
  // the exact hole this closes: the card renders "Add", the entry guard forces the sheet, and the
  // sheet would offer an Add the server then rejects in English. Refuse first, explain if we can.
  const isBlocked = notice?.tone === 'blocked' || availability?.canOrder === false;

  // Taking the way out must END this sheet's verdict, not just re-evaluate it. `pickType` commits
  // the new channel and the GRID refetches — but the sheet holds a copy taken at open time, so
  // leaving it mounted re-labels the footer to a THIRD channel and never restores Add: the guest
  // did exactly what the UI asked and the UI asks again. Closing lands them on the surface that
  // does refetch, where the card is already unblocked (and avoids stacking the follow-up modal's
  // BaseModal on this one, where a single Escape would close both).
  const switchOrderTypeAndClose = onSwitchOrderType
    ? (type: OrderType) => {
        close();
        onSwitchOrderType(type);
      }
    : undefined;

  if (!isOpen) return null;

  const { step } = flow;
  const isGuided = flow.steps.length > 1;

  // The option screen's bar. Its last step commits BACK INTO THE LINE, not an order — so it asks
  // SheetFooter for the confirm mode (a labelled Done over the same live total) instead of the
  // quantity stepper and the Add, and the money keeps rendering through the one component.
  const optionFooter = optionFlow ? <OptionFooterBar optionFlow={optionFlow} t={t} /> : null;

  // Blocked ⇒ the whole action bar is replaced by the reason and the way out, on every step. Not
  // disabled: a disabled Add is a control that explains nothing (#208), and a stepper for a
  // quantity that cannot be ordered is noise.
  const footer = footerFor({
    optionFooter,
    isBlocked,
    notice,
    onSwitchOrderType: switchOrderTypeAndClose,
    styles,
    flow,
    step,
    isSubmitting,
    quantity,
    setQuantity,
    addToCart,
    t,
  });

  return (
    <BaseModal isOpen={isOpen} onClose={dismiss} title={title} size="lg" footer={footer}>
      <div className={styles.body}>
        {optionFlow ? (
          // The per-option screen REPLACES the bundle body: the intro above describes the combo,
          // not the option being customized, and the option's steps carry their own progress rail.
          <BundleOptionCustomizationScreen flow={optionFlow} />
        ) : (
          <ProductFlowBody
            controller={controller}
            flow={flow}
            step={step}
            isGuided={isGuided}
            drinks={drinks}
            description={description}
            t={t}
            intro={intro}
          />
        )}
      </div>
    </BaseModal>
  );
}
