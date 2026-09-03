// Product-related types and interfaces
import type { Control, FieldErrors, UseFormGetValues, UseFormSetValue, FieldValues } from 'react-hook-form';

export const productTypes = ['mainItem', 'beverage', 'dessert', 'sauce', 'addOn', 'menu'] as const;

/**
 * The types the ITEM editor offers (slice S8, D7).
 *
 * `menu` is missing on purpose and the omission is load-bearing. A `menu` product is a BUNDLE: it
 * is created through `menuBundleService`, edited by `BundlePanel` against `bundleSchema`, deleted
 * by `deleteMenuBundle`, and `isMenuBundle` routes the whole editor on it. Offering it in the item
 * editor's type select advertised a conversion that does not exist — picking it saved an item whose
 * discriminator claimed to be a bundle while it carried no `menuDefinition`, so the next open sent
 * the editor down the bundle branch for a product with nothing to show. That is the definition of a
 * dead control.
 *
 * `productTypes` above KEEPS `menu`, and that is not an oversight either: it is the zod enum, and a
 * schema that rejects a value the server can legitimately send turns a data state into a save the
 * admin cannot complete and cannot explain. The vocabulary and the offer are two different lists.
 */
export const itemProductTypes = productTypes.filter((type) => type !== 'menu');

export type ProductType = (typeof productTypes)[number];

export interface Category {
  id: string;
  name: string;
  /**
   * Raw OrderChannels bitmask (`null` = every order type). The editor reads it to preview what a
   * product would inherit from its primary category; the category matrix in restaurant settings is
   * the only place it is written.
   */
  availableOrderTypes?: number | null;
}

export interface Variation {
  id?: string; // Optional for create, required for edit
  /**
   * Which global variation row this one was copied from (plan S4, backend #431's
   * `ProductVariationDto.GlobalVariationId`). Provenance only: the name and translations beside it
   * are the product's OWN copies, and editing the library row later does not change them.
   */
  globalVariationId?: string;
  name: string;
  description?: string;
  priceModifier: number;
  isActive: boolean;
  displayOrder: number;
  content: Record<
    string,
    {
      name: string;
      description?: string;
    }
  >;
}

export interface ContentItem {
  language: string;
  name: string;
  description?: string;
  ingredient?: string;
}

export interface ProductFormData {
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  type: ProductType;
  ingredients?: string;
  allergens?: string[];
  categoryIds: string[];
  primaryCategoryId: string;
  variations: Variation[];
  content: ContentItem[];
  preparationTimeMinutes: number;
  suggestedSideItemIds: string[];
}

// Extended interface for edit operations that includes additional fields
export interface EditProductFormData extends Omit<ProductFormData, 'preparationTimeMinutes'> {
  id?: string;
  preparationTimeMinutes?: number;
  displayOrder?: number;
}

// Generic interfaces for shared components
export interface BaseProductFormData {
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  isSpecial: boolean;
  type: ProductType;
  ingredients?: string;
  allergens?: string[];
  categoryIds: string[];
  primaryCategoryId: string;
  variations: Variation[];
  content: ContentItem[];
  preparationTimeMinutes: number;
  suggestedSideItemIds: string[];
}

// Component prop interfaces that work with both create and edit
//
// `ProductBasicInfoProps` and `ProductDetailsProps` are gone with slice S2: the two components they
// typed were the "Basic info" and "Details" COLUMNS, and §4 has no such thing — their controls now
// sit in the section that owns each of them (`components/admin/product/fields/`, one small file per
// group, each typed against react-hook-form directly rather than through `any`).

// `MultilingualContentProps` is gone with slice S4. The component it typed was one of THREE
// translation UIs for one concept; the Translations tab now carries a single locale switcher
// (`product-editor/translations/`) that retargets product, variation and ingredient strings at once.

export interface ProductVariationsProps {
  register: any;
  // Typed properly because S7 reads it: `fieldMessage`/`fieldAria` take react-hook-form's own
  // shape, and the surrounding `any`s are pre-existing debt this slice does not widen.
  errors: FieldErrors<FieldValues>;
  variationFields: any[];
  appendVariation: (variation: Variation) => void;
  removeVariation: (index: number) => void;
  /**
   * Move a row and renumber `displayOrder` (#593). It comes from the FORM hook, not from
   * `useFieldArray.move`, because `move` alone carries each row's stored `displayOrder` with it —
   * see `useProductEditorForm.moveVariation` for why that would silently undo the reorder.
   */
  moveVariation: (index: number, delta: -1 | 1) => void;
  /**
   * For the base row's inverted switch, which `register` cannot express — and for the name and
   * price it shows, which it WATCHES rather than takes as props: both are edited on this page, so a
   * fetched value would print a stale number under the input that changed it.
   */
  control: Control<FieldValues>;
  /** Writes a picked library row onto the row the admin is typing in — see the name type-ahead. */
  setValue: UseFormSetValue<FieldValues>;
  /** The reading language, so a suggestion can be matched on its translations and not only its name. */
  currentLanguage: string;
  /**
   * Read the form STORE. The library picker uses it to see the product's current rows at the moment
   * it opens — `variationFields` is a snapshot that `moveVariation`'s `setValue` renumbering does
   * not refresh, so its `displayOrder` values go stale after any reorder.
   */
  getValues: UseFormGetValues<FieldValues>;
}

// Interface for the new suggested side items component
export interface SuggestedSideItemsPickerProps {
  errors: any;
  control: any;
  selectedSideItemIds: string[];
  onChange: (selectedIds: string[]) => void;
  /**
   * The product being edited, on the edit route. It may never suggest ITSELF (plan S9 / D12) —
   * nothing on the server refuses that, so the guard lives in the picker. Optional because the
   * create route has no id yet.
   */
  productId?: string;
}

// Product search result interface
export interface ProductSearchResult {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  type: ProductType;
}
