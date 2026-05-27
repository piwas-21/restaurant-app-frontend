import type { MenuBundleItem, MenuItem, MenuItemContent, MenuItemImage } from '@/types/menu';
import type { MenuBundleDto, ProductContentDto, ProductContentEntryDto, ProductDto, ProductImageDto } from './types';

const PLACEHOLDER_IMAGE = '/images/placeholder-app.png';

/** Coerce wire `basePrice` (number | string | missing) into a number. */
function parseBasePrice(value: number | string | undefined): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value || '0');
  return 0;
}

/** Build the gallery used by both products and bundles (same shape). */
function mapImages(images: ProductImageDto[] | undefined, fallbackAlt: string): MenuItemImage[] {
  if (!Array.isArray(images)) return [];
  return images.map((img) => ({ url: img.url, alt: img.altText || fallbackAlt }));
}

/** Normalise the per-locale content map; falls back to an `en` entry if absent. */
function mapContent(
  content: ProductContentDto | undefined,
  fallbackName: string,
  fallbackDescription: string,
): MenuItem['content'] {
  if (!content || typeof content !== 'object') {
    return { en: { name: fallbackName, description: fallbackDescription, ingredient: '' } };
  }
  const out: Partial<Record<string, MenuItemContent>> = {};
  for (const lang of Object.keys(content)) {
    const v: ProductContentEntryDto = content[lang] ?? {};
    out[lang] = {
      name: v.name || fallbackName,
      description: v.description || '',
      ingredient: v.ingredient || '',
    };
  }
  return out;
}

/**
 * Pure product DTO → MenuItem mapper. No React, no state — unit-testable.
 * `categoryKey` is the active filter at fetch time (the hook owns that
 * context; the mapper just records it).
 */
export function mapProductDtoToMenuItem(p: ProductDto, categoryKey?: string): MenuItem {
  const fallbackName = p.name || 'Unnamed Item';
  const primaryImage =
    p.imageUrl || (Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : PLACEHOLDER_IMAGE);
  return {
    id: p.id,
    name: fallbackName,
    description: p.description || '',
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
    detailedIngredients: Array.isArray(p.detailedIngredients) ? p.detailedIngredients : [],
    content: mapContent(p.content, fallbackName, p.description || ''),
    price: parseBasePrice(p.basePrice),
    image: primaryImage,
    dietaryTags: [],
    allergens: Array.isArray(p.allergens) ? p.allergens : [],
    preparationTimeMinutes: typeof p.preparationTimeMinutes === 'number' ? p.preparationTimeMinutes : undefined,
    variations: Array.isArray(p.variations) ? p.variations : [],
    suggestedSideItems: Array.isArray(p.suggestedSideItems) ? p.suggestedSideItems : [],
    categoryKey,
    isSpecial: p.isSpecial,
    isActive: p.isActive,
    isAvailable: p.isAvailable,
    images: mapImages(p.images, fallbackName),
    longDescription: p.description || '',
  };
}

/** Pure bundle DTO → MenuBundleItem mapper. */
export function mapBundleDtoToMenuBundleItem(bundle: MenuBundleDto): MenuBundleItem {
  const fallbackName = bundle.name || 'Unnamed Bundle';
  return {
    id: bundle.id,
    name: fallbackName,
    description: bundle.description || '',
    basePrice: parseBasePrice(bundle.basePrice),
    content: bundle.content || {},
    // Wire-defensive default: backend should always send a full MenuDefinition,
    // but the original hook tolerated a missing one by substituting an empty
    // sections list. Preserve that behaviour with a documented unknown-cast.
    menuDefinition: bundle.menuDefinition || ({ sections: [] } as unknown as MenuBundleItem['menuDefinition']),
    images: mapImages(bundle.images, fallbackName),
    isActive: bundle.isActive ?? true,
    isAvailable: bundle.isAvailable ?? true,
    isSpecial: bundle.isSpecial || false,
    preparationTimeMinutes: bundle.preparationTimeMinutes,
    displayOrder: bundle.displayOrder || 0,
  };
}

/** Hide-on-display filter shared by both fetchers. */
export function isVisible<T extends { isActive?: boolean; isAvailable?: boolean }>(entity: T): boolean {
  return entity.isActive !== false && entity.isAvailable !== false;
}
