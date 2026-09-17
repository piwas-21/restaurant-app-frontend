import type { Product } from '@/app/admin/menu-management/interfaces';
import { isMenuBundle } from './productTypeFilter';

export interface OfferFamilyRow {
  kind: 'family';
  anchor: Product;
  menuOffers: Product[];
}

export interface IndependentOfferRow {
  kind: 'independent';
  product: Product;
}

export type GroupedOfferRow = OfferFamilyRow | IndependentOfferRow;

const linkedParentId = (product: Product): string | null => {
  if (!isMenuBundle(product)) return null;
  return product.parentOfferProductId ?? product.menuDefinition?.parentOfferProductId ?? null;
};

/**
 * Groups only explicit backend relationships. Names such as `Menu Foo` are never interpreted as
 * a relationship, and a menu whose parent is not in this page remains an independent row so
 * pagination can never make an existing offer disappear.
 */
export function groupProductsIntoOfferRows(products: Product[]): GroupedOfferRow[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const offersByParent = new Map<string, Product[]>();

  products.forEach((product) => {
    const parentId = linkedParentId(product);
    if (parentId && byId.has(parentId)) {
      const offers = offersByParent.get(parentId) ?? [];
      offers.push(product);
      offersByParent.set(parentId, offers);
    }
  });

  const consumed = new Set<string>();
  const rows: GroupedOfferRow[] = [];
  products.forEach((product) => {
    if (consumed.has(product.id)) return;
    const menuOffers = offersByParent.get(product.id);
    if (!menuOffers || menuOffers.length === 0) {
      rows.push({ kind: 'independent', product });
      return;
    }

    consumed.add(product.id);
    menuOffers.forEach((offer) => consumed.add(offer.id));
    rows.push({ kind: 'family', anchor: product, menuOffers });
  });
  return rows;
}
