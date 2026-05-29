/**
 * Menu-bundle interfaces: a menu definition with sections, scheduling, and the
 * customer's selected options. Extracted from types/menu.ts (Sprint 4/6 type-file split).
 */

import { DetailedIngredient, SuggestedSideItem, MenuItemImage } from './shared';

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
 * Individual item choice within a menu section
 */
export interface MenuSectionItem {
  id: string;
  productId: string;
  productName?: string;
  additionalPrice: number;
  displayOrder: number;
  isDefault: boolean;
  ingredients?: string[];
  allergens?: string[];
  detailedIngredients?: DetailedIngredient[];
  suggestedSideItems?: SuggestedSideItem[];
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
  excludedIngredients?: string[];
  ingredientQuantities?: Record<string, number>;
  selectedSideItems?: Array<{ id: string; quantity: number }>;
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
}
