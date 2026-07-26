'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCart } from '@/components/cart/CartContext';
import { getAddToCartErrorMessage } from '@/utils/addToCartError';
import type { OrderDto } from '@/types/order';

const ANCHOR = { vertical: 'bottom', horizontal: 'right' } as const;

/**
 * Re-order a past order, reporting what did NOT make it (ORDER-TYPE-AVAILABILITY-PLAN gap G5).
 *
 * The loop used to abort on the first rejection inside one try/catch, which was survivable while
 * nothing could reject an add for a per-item reason. Now that an item can be blocked on the
 * basket's order type, that shape fails badly: a dine-in order re-ordered under Delivery stops at
 * the first blocked line, silently leaves the earlier lines in the cart, and reports a single
 * generic failure — so the guest sees a half-filled cart and no idea which item was refused.
 *
 * Add-what-fits, report-the-rest (plan §2, "Re-order with conflicts"). Each line is attempted
 * independently and failures are collected by name, so the message can say what to do about them.
 */
export function useReorder(setReorderingOrderId: (id: string | null) => void) {
  const { t } = useTranslation();
  const router = useRouter();
  const { addItem } = useCart();
  const { enqueueSnackbar } = useSnackbar();

  return useCallback(
    async (order: OrderDto) => {
      setReorderingOrderId(order.id);
      // `?? []` so a malformed order cannot throw before the spinner is cleared below.
      const lines = (order.items ?? []).filter((item) => item.productId);
      const failures: string[] = [];
      let added = 0;

      for (const item of lines) {
        try {
          await addItem({
            productId: item.productId,
            productVariationId: item.productVariationId,
            menuId: item.menuId,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions,
          });
          added += 1;
        } catch (error) {
          // One reason per line. `getAddToCartErrorMessage` already names the item and the
          // channels it IS available on when the server tagged the rejection; anything else falls
          // back to the REORDER wording, not the generic add-to-cart one — the guest is looking at
          // an order list, not a product.
          failures.push(getAddToCartErrorMessage(error, t, 'failed_to_reorder'));
        }
      }

      setReorderingOrderId(null);

      if (failures.length === 0) {
        enqueueSnackbar(t('items_added_to_cart', 'Items added to cart'), {
          variant: 'success',
          anchorOrigin: ANCHOR,
        });
        router.push('/cart');
        return;
      }

      if (added === 0) {
        // Nothing landed — staying put beats sending the guest to an unchanged cart.
        enqueueSnackbar(failures[0], { variant: 'error', anchorOrigin: ANCHOR });
        return;
      }

      // Partial: say how much got through, then why the rest did not. Dedup because several
      // lines from the same blocked category produce the same sentence.
      enqueueSnackbar(
        `${t('reorder_partial', 'Added {{added}} of {{total}} items.', { added, total: lines.length })} ${[
          ...new Set(failures),
        ].join(' ')}`,
        { variant: 'warning', anchorOrigin: ANCHOR },
      );
      router.push('/cart');
    },
    [addItem, enqueueSnackbar, router, setReorderingOrderId, t],
  );
}
