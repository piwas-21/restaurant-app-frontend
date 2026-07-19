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
}
