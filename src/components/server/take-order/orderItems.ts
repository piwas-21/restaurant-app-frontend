/**
 * Pure order-item helpers for the take-order flow.
 *
 * Extracted verbatim from the former `TakeOrderModal` god-file so the hook can
 * stay under the §4 length limit and so the load-bearing dedup + note-building
 * logic is independently unit-testable. Behaviour is byte-for-byte identical to
 * the original inline implementation — do not "fix" the projection or the note
 * string without a product decision.
 */
import { Product } from '@/services/serverService';
import { CustomizationResult } from '../ProductCustomization';

export interface OrderItem {
  product: Product;
  quantity: number;
  variationId?: string;
  variationName?: string;
  notes?: string;
  excludedIngredients?: string[];
  addedIngredients?: Array<{ id: string; name: string; price: number }>;
  sideItems?: Array<{ id: string; name: string; quantity: number; price: number }>;
  unitPrice: number;
}

/**
 * The `/api/Products` payload carries the server-flow fields (type, categories,
 * primaryCategoryId, variations) that the admin menu-management `Product` type
 * used by `getProducts` omits, which is why the original code reached for `any`.
 * Describe just the fields this flow reads and cast once here.
 */
interface RawMenuProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  type: string;
  categories?: Product['categories'];
  primaryCategoryId?: string;
  imageUrl?: string;
  variations?: Product['variations'];
}

/** Project the raw paginated `/api/Products` items onto the server `Product` type. */
export function mapMenuProducts(items: readonly unknown[]): Product[] {
  return (items as RawMenuProduct[]).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    basePrice: p.basePrice,
    isActive: p.isActive,
    isAvailable: p.isAvailable,
    type: p.type,
    categories: p.categories,
    primaryCategoryId: p.primaryCategoryId,
    imageUrl: p.imageUrl,
    variations: p.variations,
  }));
}

/**
 * Add a customized product to the order list. If an identical line already
 * exists (same product + variation + excluded/added/side selections) its
 * quantity is incremented; otherwise a new line with a built note string is
 * appended. The dedup key and note format are load-bearing — preserve exactly.
 */
export function addCustomizedItem(prev: OrderItem[], product: Product, result: CustomizationResult): OrderItem[] {
  // Check if identical item already exists
  const existingIndex = prev.findIndex(
    (item) =>
      item.product.id === product.id &&
      item.variationId === result.variationId &&
      JSON.stringify(item.excludedIngredients) === JSON.stringify(result.excludedIngredients) &&
      JSON.stringify(item.addedIngredients?.map((i) => i.id)) ===
        JSON.stringify(result.addedIngredients.map((i) => i.id)) &&
      JSON.stringify(item.sideItems?.map((s) => s.id)) === JSON.stringify(result.sideItems.map((s) => s.id)),
  );

  if (existingIndex >= 0) {
    // Increment quantity
    const updated = [...prev];
    updated[existingIndex].quantity += 1;
    return updated;
  }

  // Build customization notes
  const noteParts: string[] = [];
  if (result.variationName) {
    noteParts.push(result.variationName);
  }
  if (result.excludedIngredients.length > 0) {
    noteParts.push(`No: ${result.excludedIngredients.join(', ')}`);
  }
  if (result.addedIngredients.length > 0) {
    noteParts.push(`Add: ${result.addedIngredients.map((i) => i.name).join(', ')}`);
  }
  if (result.sideItems.length > 0) {
    noteParts.push(`Sides: ${result.sideItems.map((s) => s.name).join(', ')}`);
  }
  if (result.specialInstructions) {
    noteParts.push(result.specialInstructions);
  }

  return [
    ...prev,
    {
      product,
      quantity: 1,
      variationId: result.variationId,
      variationName: result.variationName,
      notes: noteParts.join(' | ') || undefined,
      excludedIngredients: result.excludedIngredients,
      addedIngredients: result.addedIngredients,
      sideItems: result.sideItems,
      unitPrice: result.finalPrice,
    },
  ];
}
