'use client';

import { loadOrderAmendmentTranslations } from '@/lib/orderAmendmentTranslations';
import { loadServerOrderTranslations } from '@/lib/serverOrderTranslations';
import { useLazyLocaleTranslations } from './useLazyLocaleTranslations';

const loadServerOrderWorkspaceTranslations = async (
  instance: Parameters<typeof loadServerOrderTranslations>[0],
  language: string | undefined,
): Promise<void> => {
  await Promise.all([
    loadServerOrderTranslations(instance, language),
    loadOrderAmendmentTranslations(instance, language),
  ]);
};

/** Load both server-order copy and amendment read-only notices only on explicit order routes. */
export function useServerOrderTranslations(enabled: boolean) {
  return useLazyLocaleTranslations(enabled, loadServerOrderWorkspaceTranslations);
}
