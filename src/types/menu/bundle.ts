/**
 * Menu-bundle interfaces: a menu definition with sections, scheduling, and the
 * customer's selected options. Extracted from types/menu.ts (Sprint 4/6 type-file split).
 */

import { DetailedIngredient, MenuSectionSuggestedSideItem, MenuItemImage } from './shared';
import type { SauceGroupCarrier } from './sauce';
import type { ItemAvailability } from './availability';

/**
 * Menu bundle definition with sections and scheduling
 */
export interface MenuDefinition {
  id: string;
  isAlwaysAvailable: boolean;
  startTime?: string; // HH:mm format
  endTime?: string; // HH:mm format
  availableMonday: boolean;
  availableTuesday: boolean;
  availableWednesday: boolean;
  availableThursday: boolean;
  availableFriday: boolean;
  availableSaturday: boolean;
  availableSunday: boolean;
  sections: MenuSection[];
}

/**
 * Section within a menu (e.g., "Choose Drink", "Select Side")
 */
export interface MenuSection {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  items: MenuSectionItem[];
}

/**
 * Individual item choice within a menu section.
 *
 * It carries the sauce group rule (S6) because a bundle option follows the OPTION PRODUCT's own
 * rule — the option IS that product, and the parent bundle owns no sauce rows for a per-product
 * allowance to apply to. The server prices the child with `childProduct.SauceIncludedFree`, so
 * these three fields are what stops the live "Add • CHF X" disagreeing with it.
 */
export interface MenuSectionItem extends SauceGroupCarrier {
  id: string;
  productId: string;
  productName?: string;
  additionalPrice: number;
  displayOrder: number;
  isDefault: boolean;
  ingredients?: string[];
  allergens?: string[];
  detailedIngredients?: DetailedIngredient[];
  suggestedSideItems?: MenuSectionSuggestedSideItem[];
}

/**
 * Selected menu option by customer
 */
export interface SelectedMenuOption {
  sectionId: string;
  itemId: string;
  quantity: number;
  // Nested customization for this item
  specialInstructions?: string;
  selectedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
}

/**
 * Menu bundle for customer display
 */
export interface MenuBundleItem {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  content?: Record<string, { name: string; description: string }>;
  menuDefinition: MenuDefinition;
  images?: MenuItemImage[];
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  preparationTimeMinutes?: number;
  displayOrder: number;
  /**
   * The bundle's own allergen labelling, normalised to an array by the mapper.
   *
   * Optional for the same reason every other §9.2-era field here is: against a backend predating
   * backend #477 the bundle payload carries none. Note what absence MEANS to `useMenuFilters` —
   * an item with no tokens survives every "No …" chip, so an unlabelled bundle is shown to a guest
   * excluding gluten. That is permissive-on-missing-data like its neighbours, and it is the reason
   * completeness of the LABELLING is a safety property rather than a display one.
   */
  allergens?: string[];
  /**
   * Server-resolved per-order-type verdict for the channel the guest is browsing on
   * (ORDER-TYPE-AVAILABILITY-PLAN §9.2). Judges the BUNDLE's own channel set — its stored mask, else
   * its primary category's — not its options': a combo whose optional side is takeaway-only is still
   * orderable on dine-in, because the guest picks a different side.
   *
   * Optional because it is absent against a backend that predates §9.2, and absent means
   * unrestricted, matching every other permissive-on-missing-data default in this feature.
   */
  availability?: ItemAvailability;
}
