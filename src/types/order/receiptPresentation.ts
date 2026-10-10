/** Additive, frozen preparation facts. Missing metadata remains unknown. */
export type OrderQuantityBasis = 'PerParentUnit' | 'LineTotal' | 'Unknown';
export type OrderConfigurationScope = 'SharedAcrossParentUnits' | 'IndependentParentUnits' | 'Unknown';
export type OrderCompositionRole =
  'Menu' | 'Dish' | 'RequiredChoice' | 'Extra' | 'Sauce' | 'Side' | 'Drink' | 'Ingredient' | 'Unknown';

export interface OrderReceiptPresentation {
  quantityBasis?: OrderQuantityBasis | null;
  configurationScope?: OrderConfigurationScope | null;
  compositionRole?: OrderCompositionRole | null;
  presentationLabel?: string | null;
  presentationOrder?: number | null;
  menuSectionItemId?: string | null;
  suggestedSideItemId?: string | null;
  parentComponentOrderItemId?: string | null;
}
