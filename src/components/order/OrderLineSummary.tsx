'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import { type LineSummary, type LineIngredientDiff, type LineChild } from './lineSummary';
import styles from './OrderLineSummary.module.css';

/**
 * Every value rendered here is TENANT-authored — ingredient, component and side-item names, and
 * free-text special instructions — so each carries `dir="auto"`: an English name inside an Arabic
 * page is an LTR run whose trailing neutral punctuation would otherwise take the paragraph's
 * direction and jump to the far end (DESIGN-SYSTEM.md §8.2). The `.label` spans beside them are
 * locale strings and correctly inherit.
 */

function DiffRows({ diff }: Readonly<{ diff: LineIngredientDiff }>) {
  const { t } = useTranslation();
  return (
    <>
      {diff.added.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('added_ingredients', 'Added')}:</span>
          <span className={styles.value}>
            {diff.added.map((ing, i) => (
              <React.Fragment key={ing.name}>
                {i > 0 && ', '}
                {/* Only the NAME is isolated. `dir="auto"` implies `unicode-bidi: isolate`, so a
                    separator inside the span paints at that box's own leading edge and the gap
                    between two items collapses to 0px — measured, `ColeslawFries`. The numeric
                    suffix is direction-neutral and stays outside too. */}
                <span dir="auto">{ing.name}</span>
                {ing.quantity > 1 && ` × ${ing.quantity}`}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}
      {diff.removed.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('removed_ingredients', 'Removed')}:</span>
          <span dir="auto" className={styles.value}>
            {diff.removed.join(', ')}
          </span>
        </div>
      )}
    </>
  );
}

/**
 * Bundle components, indented one level per depth. Recursive because the order/cart trees nest to
 * arbitrary depth (a component of a component would otherwise never be drawn).
 */
function ChildList({ items, showPrices }: Readonly<{ items: LineChild[]; showPrices: boolean }>) {
  const { t } = useTranslation();
  if (items.length === 0) return null;

  // A surface shows the count or the price, never both — because the pair stops reconciling after
  // one click.
  //
  // At ADD time it does reconcile, and it is worth being exact about that rather than repeating the
  // guess this comment used to carry: `BasketItemFactory` stores a bundle child's `Quantity` as
  // `item.Quantity * option.Quantity` and its `UnitPrice` as `sectionItem.AdditionalPrice`, while
  // the parent's per-unit price sums `AdditionalPrice * selection.Quantity` and is then multiplied
  // by `item.Quantity`. So `child.Quantity * child.UnitPrice` IS the component's share of the line
  // total, and "× 2  +CHF 1.50" is an ordinary quantity × unit-price reading of CHF 3.00.
  //
  // What breaks it is that nothing rescales a child: `BasketService.UpdateBasketItemAsync` writes
  // `Quantity`/`ItemTotal` on the matched row only. Step a bundle from 1 to 2 and the child count
  // still says 2 when the line now holds 4 — so on /cart, the one surface with BOTH the stepper and
  // the price, a number that reconciled a moment ago silently stops. The count is what goes,
  // because the price is the value the guest cannot derive from anything else on the card.
  //
  // (The staleness itself is older and wider — `CartLineList` and `checkout/OrderItemsList` print
  // the same count with no price beside it. Not fixed here; see the follow-up on #189.)
  const showQuantity = !showPrices;

  return (
    <ul className={styles.children}>
      {items.map((child) => {
        const hasDetails = child.diff.added.length > 0 || child.diff.removed.length > 0 || !!child.specialInstructions;
        return (
          <li key={child.id ?? child.name} className={styles.child}>
            <span dir="auto" className={styles.childName}>
              {child.name}
              {showQuantity && child.quantity > 1 && ` × ${child.quantity}`}
            </span>
            {/* Outside the name's isolate, unlike the `× N` above — that one annotates the name and
                rides inside it, while this annotates the row. `> 0` because a bundle component with
                no upcharge would otherwise print a bare "+0.00". */}
            {showPrices && typeof child.price === 'number' && child.price > 0 && (
              <span className={styles.childPrice}>+{formatPlainCurrency(child.price)}</span>
            )}
            {hasDetails && (
              <div className={styles.childDetails}>
                <DiffRows diff={child.diff} />
                {child.specialInstructions && (
                  <div className={styles.row}>
                    <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
                    <span dir="auto" className={styles.value}>
                      {child.specialInstructions}
                    </span>
                  </div>
                )}
              </div>
            )}
            <ChildList items={child.children} showPrices={showPrices} />
          </li>
        );
      })}
    </ul>
  );
}

interface OrderLineSummaryProps {
  readonly line: LineSummary;
  /** Hide the line's own special-instructions row (e.g. the cart shows an editable editor instead). */
  readonly hideInstructions?: boolean;
  /**
   * Show each bundle component's upcharge beside its name **instead of its quantity** — the count
   * goes stale against the price the first time a stepper is used, so no surface shows both; see
   * `ChildList`. Off everywhere but the /cart card, which showed the upcharge and no count before
   * it was migrated onto this component (#189) — see `LineChild.price`. Opt-IN so that migration
   * could not add a price to the eight render sites that never had one.
   */
  readonly showChildPrices?: boolean;
  /**
   * Draw the chosen variation as the first row. Opt-IN, because only the basket flyout was missing
   * it: the /cart card and the checkout list draw their own, and turning it on globally would print
   * the size twice there. See `LineSummary.variation`.
   */
  readonly showVariation?: boolean;
}

/**
 * Read-only, shared renderer for a line's customizations: ingredient diffs, add-on side items,
 * special requests, and bundle components (indented one level with their own diffs). Renders
 * nothing when there is nothing to show. The two order/cart shapes feed it via the adapters in
 * lineSummary.ts (menu-bundles redesign slice 2, #174).
 */
export default function OrderLineSummary({
  line,
  hideInstructions = false,
  showChildPrices = false,
  showVariation = false,
}: OrderLineSummaryProps) {
  const { t } = useTranslation();
  const showInstructions = !hideInstructions && !!line.specialInstructions;
  // Part of `nothingToShow`, not just of the markup: a plain pizza in a size and with no
  // customization at all has an EMPTY summary, and gating the row alone would leave the one surface
  // this exists for still not showing the size.
  const variationRow = showVariation && !!line.variation;

  const nothingToShow =
    line.diff.added.length === 0 &&
    line.diff.removed.length === 0 &&
    line.sideItems.length === 0 &&
    line.children.length === 0 &&
    !showInstructions &&
    !variationRow;
  if (nothingToShow) return null;

  return (
    <div className={styles.summary}>
      {variationRow && (
        <div className={styles.row}>
          <span className={styles.label}>{t('variation', 'Size/Variation')}:</span>
          <span dir="auto" className={styles.value}>
            {line.variation}
          </span>
        </div>
      )}

      <DiffRows diff={line.diff} />

      {line.sideItems.length > 0 && (
        <div className={styles.row}>
          <span className={styles.label}>{t('side_items', 'Side Items')}:</span>
          <span className={styles.value}>
            {line.sideItems.map((side, i) => (
              <React.Fragment key={side.id ?? side.name}>
                {i > 0 && ', '}
                {/* Separator and numeric suffixes outside the isolate — see the added row above. */}
                <span dir="auto">{side.name}</span>
                {side.quantity > 1 && ` × ${side.quantity}`}
                {typeof side.price === 'number' && side.price > 0 && ` (${formatPlainCurrency(side.price)})`}
              </React.Fragment>
            ))}
          </span>
        </div>
      )}

      {showInstructions && (
        <div className={styles.row}>
          <span className={styles.label}>{t('special_requests', 'Special Requests')}:</span>
          <span dir="auto" className={styles.value}>
            {line.specialInstructions}
          </span>
        </div>
      )}

      <ChildList items={line.children} showPrices={showChildPrices} />
    </div>
  );
}
