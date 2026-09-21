import { decideProductTap } from '@/components/catalog/productTap';
import type { ProductTapDecision } from '@/components/catalog/productTap';

/**
 * The tap decision for the counter catalog (cashier POS plan §5.3.2): a simple product adds on
 * the tap; a product with ANY choosable row — variation, ingredient, suggested side — opens the
 * shared customization sheet instead. The same three sources the sheet itself reads decide, so
 * the two paths cannot disagree about what "simple" means.
 */

export type TapDecision = ProductTapDecision;

/** Cashier-compatible name retained while the decision logic is shared with Server. */
export const decideTap = decideProductTap;
