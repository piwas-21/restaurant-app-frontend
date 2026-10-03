import type { i18n as I18nInstance } from 'i18next';
import { loadOrderWorkspaceTranslations, type OrderWorkspaceLocaleBundle } from './orderWorkspaceTranslations';

export type OrderAmendmentLocaleBundle = Pick<OrderWorkspaceLocaleBundle, 'orderAmendments'>;

export function loadOrderAmendmentTranslations(instance: I18nInstance, language: string | undefined): Promise<void> {
  return loadOrderWorkspaceTranslations(instance, language);
}
