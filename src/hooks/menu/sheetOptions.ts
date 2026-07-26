import type { ItemAvailability } from '@/types/menu';

/**
 * Options for opening the customization sheet (`useItemCustomizationSheet` /
 * `useCatalogSheet`). Its own module so both the hooks and the menu cards can
 * import the type without dragging in the hook.
 */
export interface OpenSheetOptions {
  /**
   * Always open the sheet, skipping the no-options quick-add. Set by the "Details" and title
   * affordances, whose job is to SHOW the item — never to add it. "Add to Order" leaves this unset,
   * so a simple item still adds straight to the cart.
   */
  forceSheet?: boolean;
  /**
   * The per-order-type verdict the LIST already resolved for this item, carried into the sheet so it
   * can refuse an add the card just blocked (ORDER-TYPE-AVAILABILITY-PLAN §9.10 — a blocked card was
   * two clicks from being defeated via "Details", with only the server's untranslated message left
   * to stop it).
   *
   * Handed over rather than re-fetched with `?RequestedOrderType=` deliberately. Both would work —
   * `GetProductByIdQuery` binds the channel too — but a second resolution at a second moment can
   * disagree with the card the guest is looking at, and "the card said no, the sheet said yes" is
   * worse than either answer. One verdict, one moment, both surfaces.
   *
   * Absent for the by-id entry points (the featured special), which therefore stay unguarded — that
   * is gap G7 / §9.2, unchanged here.
   */
  availability?: ItemAvailability;
}
