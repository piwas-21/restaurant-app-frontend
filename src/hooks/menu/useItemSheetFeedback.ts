'use client';

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCartFeedback } from '@/hooks/cart/useCartFeedback';
import { localizedName } from '@/utils/localizedContent';
import type { DetailedProduct } from '@/types/menu';

export function useItemSheetFeedback(onAdded?: () => void) {
  const { i18n } = useTranslation();
  const { notifyItemAdded, notifyAddFailed } = useCartFeedback();
  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const notifyAdded = useCallback(
    (added: Pick<DetailedProduct, 'content' | 'name'>) => {
      notifyItemAdded(localizedName(added, currentLanguage));
      onAdded?.();
    },
    [notifyItemAdded, onAdded, currentLanguage],
  );

  return { currentLanguage, notifyAdded, notifyAddFailed };
}
