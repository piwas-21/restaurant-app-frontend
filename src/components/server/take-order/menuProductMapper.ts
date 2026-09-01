import type { Product } from '@/services/serverService';

/** The subset of `/api/Products` read by the waiter grid. */
interface RawMenuProduct {
  id: string;
  name: string;
  description?: string;
  basePrice: number;
  isActive: boolean;
  isAvailable: boolean;
  type: string;
  categories?: NonNullable<Product['categories']>;
  primaryCategoryId?: string;
  imageUrl?: string;
  variations?: NonNullable<Product['variations']>;
}

/** Project a public-menu response onto the staff grid's product shape. */
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
