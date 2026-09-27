import type { CategoryTranslations } from '@/types/categoryTranslations';
import type { OrderType } from '@/types/order';

export type ApiCategory = {
  id: string;
  name: string;
  /** The tenant's blurb rendered under the menu section heading. */
  description?: string | null;
  /** Reviewed category names and descriptions, keyed by locale code. */
  translations?: CategoryTranslations;
  /** Language of the base name and description; `null` is retained for legacy rows. */
  sourceLocale?: string | null;
  /** Decoded order channels; absent means unrestricted for older backend versions. */
  allowedOrderTypes?: OrderType[];
};
