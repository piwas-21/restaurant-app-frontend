'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import BaseModal from '@/components/design-system/BaseModal';
import ProductSheetBody, { type ProductSheetController } from '@/components/menu/customization/ProductSheetBody';
import BundleSheetBody, { type BundleSheetController } from '@/components/menu/customization/BundleSheetBody';
import MenuCardAvailability from '@/components/menu/MenuCardAvailability';
import { useItemAvailabilityNotice } from '@/hooks/menu/useItemAvailabilityNotice';
import type { OrderType } from '@/types/order';
import styles from './ItemCustomizationSheet.module.css';

export type SheetController = ProductSheetController | BundleSheetController;

/**
 * The single customer customization surface (menu-bundles redesign #175, slice 6) — a `BaseModal`
 * sheet that replaces `CustomizationModal`, `ProductDetailsModal` and `MenuCustomizationModal`.
 * One chrome (title, description, sticky quantity + live-priced "Add • CHF X" footer) over a body
 * that varies by `controller.kind`; both controllers price through the same backend-faithful
 * `useLinePrice`, so a product line and a bundle line can never drift apart again.
 */
interface ItemCustomizationSheetProps {
  controller: SheetController;
  /**
   * Commit a different order type from the blocked-state switch. Same instance the cards use — the
   * page's `useOrderTypeFollowUp().pickType`, so the follow-up modal actually opens.
   */
  onSwitchOrderType?: (type: OrderType) => void;
}

export default function ItemCustomizationSheet({
  controller,
  onSwitchOrderType,
}: Readonly<ItemCustomizationSheetProps>) {
  const { t } = useTranslation();
  const { isOpen, title, description, quantity, setQuantity, linePrice, isSubmitting, addToCart, close } = controller;

  // The verdict the browse card resolved, handed over on open (§9.10). A product carries it in via
  // `OpenSheetOptions`; a combo carries its own, because the bundle the sheet opens on IS the browse
  // row (no re-fetch, so no second resolution that could disagree). Since §9.2 both are real
  // verdicts — before it, a blocked combo reached this footer with nothing to say and offered Add.
  const availability =
    controller.kind === 'product' ? controller.product?.availability : controller.bundle?.availability;
  const notice = useItemAvailabilityNotice(availability);

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

  // Blocked ⇒ the quantity stepper and "Add" are replaced outright by the reason and the way out.
  // Not disabled: a disabled Add is a control that explains nothing (#208), and a stepper for a
  // quantity that cannot be ordered is noise.
  const footer = isBlocked ? (
    // `notice` can be absent here — blocked-with-nothing-to-say, the load window above. An empty
    // footer for that instant beats an Add the server will refuse.
    <div className={styles.footer}>
      {notice && (
        <MenuCardAvailability
          notice={notice}
          reasonId="sheet-availability-reason"
          onSwitchOrderType={switchOrderTypeAndClose}
          styles={styles}
        />
      )}
    </div>
  ) : (
    <div className={styles.footer}>
      <div className={styles.quantityStepper} aria-label={t('quantity')}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          aria-label={t('decrease_quantity', 'Decrease quantity')}
        >
          <Minus size={16} />
        </button>
        <span className={styles.quantityValue}>{quantity}</span>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(quantity + 1)}
          aria-label={t('increase_quantity', 'Increase quantity')}
        >
          <Plus size={16} />
        </button>
      </div>
      <button type="button" className={styles.addButton} onClick={addToCart} disabled={isSubmitting}>
        {t('add_to_order')} • {formatPlainCurrency(linePrice.total)}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={title} size="lg" footer={footer}>
      <div className={styles.body}>
        {description && <p className={styles.description}>{description}</p>}
        {controller.kind === 'bundle' ? (
          <BundleSheetBody controller={controller} />
        ) : (
          <ProductSheetBody controller={controller} />
        )}
      </div>
    </BaseModal>
  );
}
