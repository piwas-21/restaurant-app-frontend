'use client';

import { loadOrderAmendmentTranslations } from '@/lib/orderAmendmentTranslations';
import { useLazyLocaleTranslations, type LocaleTranslationLoad } from '@/hooks/useLazyLocaleTranslations';

/** Keep order-workspace locale data out of the shared client bundle until a relevant UI is used. */
export function useOrderAmendmentTranslations(enabled: boolean): LocaleTranslationLoad {
  return useLazyLocaleTranslations(enabled, loadOrderAmendmentTranslations);
}
