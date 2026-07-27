'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { getAddToCartErrorMessage } from '@/utils/addToCartError';

/**
 * The two toasts the customer customization sheets owe the guest after an add: the success
 * confirmation and the failure reason. Both sheets had byte-identical copies of the success
 * snackbar and of a hardcoded failure string that discarded the server's message — one hook so the
 * per-order-type reason (ORDER-TYPE-AVAILABILITY-PLAN §9.4) is bound in exactly one place.
 *
 * `/orders` reorder is deliberately NOT a consumer: it toasts once for a whole batch of adds and
 * anchors bottom-right, so it calls `getAddToCartErrorMessage` directly.
 */
export function useCartFeedback() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const notifyItemAdded = useCallback(
    (itemName: string) => {
      enqueueSnackbar(t('item_added_to_cart_toast', { itemName }), {
        variant: 'success',
        autoHideDuration: 2000,
        anchorOrigin: { vertical: 'top', horizontal: 'center' },
      });
    },
    [enqueueSnackbar, t],
  );

  /**
   * @param fallbackKey used only when the server gave no guest-facing reason — see
   * `getAddToCartErrorMessage`.
   */
  const notifyAddFailed = useCallback(
    (error: unknown, fallbackKey?: string) => {
      enqueueSnackbar(getAddToCartErrorMessage(error, t, fallbackKey), { variant: 'error' });
    },
    [enqueueSnackbar, t],
  );

  return { notifyItemAdded, notifyAddFailed };
}
