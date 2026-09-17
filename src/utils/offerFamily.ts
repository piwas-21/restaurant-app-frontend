import type {
  CatalogOfferFamily,
  CatalogOfferFamilyDto,
  CatalogOfferSummaryDto,
  CatalogOfferTarget,
  CatalogOfferTargetDto,
} from '@/types/menu/offerFamily';
import type { CatalogItem } from '@/types/menu';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';

const parsePrice = (value: number | string | undefined): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

function mapContent(content: CatalogOfferSummaryDto['content'], fallbackName: string) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return undefined;
  return Object.fromEntries(
    Object.entries(content).map(([locale, value]) => [
      locale,
      { name: value?.name || fallbackName, description: value?.description || '' },
    ]),
  );
}

function isBundleSummary(summary: CatalogOfferSummaryDto): boolean {
  return summary.isBundle === true || summary.kind === 'bundle' || summary.kind === 'menu';
}

function toCardSummary(summary: CatalogOfferSummaryDto, id: string): CatalogItem | null {
  const name = summary.name?.trim();
  if (!name) return null;
  const isBundle = isBundleSummary(summary);
  return {
    kind: isBundle ? 'bundle' : 'product',
    id,
    name,
    description: summary.description,
    content: mapContent(summary.content, name),
    imageUrl: summary.imageUrl || FALLBACK_IMAGE,
    price: parsePrice(summary.price ?? summary.basePrice),
    isBundle,
    priceEditability: isBundle ? 'bundle' : (summary.variations?.length ?? 0) > 0 ? 'variations' : 'editable',
    allergens: Array.isArray(summary.allergens) ? summary.allergens : [],
    isSpecial: summary.isSpecial,
    isAvailable: summary.isAvailable,
    availability: summary.availability,
  };
}

function toTarget(dto: CatalogOfferTargetDto): CatalogOfferTarget | null {
  if (!dto.productId) return null;
  // Menu-offer rows intentionally contain only the linked bundle id and pricing/availability
  // fields. The label is supplied by the localized mode choice, so a missing name is valid here.
  const name = dto.name?.trim() || dto.productId;
  return {
    productId: dto.productId,
    kind: 'bundle',
    parentVariationId: dto.parentVariationId,
    variationName: dto.variationName,
    name,
    description: dto.description,
    content: mapContent(dto.content, name),
    price: parsePrice(dto.price ?? dto.basePrice),
    imageUrl: dto.imageUrl,
    isActive: dto.isActive,
    isAvailable: dto.isAvailable,
    availability: dto.availability,
    scheduleAvailable: dto.scheduleAvailable,
    allergens: Array.isArray(dto.allergens) ? dto.allergens : [],
  };
}

/** Convert the provisional aggregate wire response into a strict guest view-model. */
export function mapCatalogOfferFamilyDto(dto: CatalogOfferFamilyDto): CatalogOfferFamily | null {
  if (!dto.anchor) return null;
  const anchorId = dto.anchor.productId || dto.anchor.id || dto.id;
  if (!anchorId) return null;
  const anchor = toCardSummary(dto.anchor, anchorId);
  if (!anchor) return null;
  const menuOffers = (dto.menuOffers ?? []).filter(isTarget).map(toTarget).filter(isTargetValue);
  const prices = [anchor.price, ...menuOffers.map((offer) => offer.price)].filter((price) => price >= 0);
  const basePrice = parsePrice(dto.anchor.basePrice ?? dto.anchor.price);
  return {
    id: dto.id || anchorId,
    anchor,
    menuOffers,
    categoryIds: normaliseIds(dto.categoryIds),
    startingPrice: parsePrice(dto.startingPrice ?? Math.min(...prices)),
    variationOptions: (dto.anchor.variations ?? [])
      .filter(
        (
          variation,
        ): variation is {
          id: string;
          name: string;
          finalPrice?: number | string;
          priceModifier?: number | string;
          isActive?: boolean;
        } => typeof variation.id === 'string' && typeof variation.name === 'string' && variation.isActive !== false,
      )
      .map((variation) => ({
        id: variation.id,
        name: variation.name,
        price:
          variation.finalPrice !== undefined
            ? parsePrice(variation.finalPrice)
            : basePrice + parsePrice(variation.priceModifier),
      })),
  };
}

function isTarget(value: CatalogOfferTargetDto): value is CatalogOfferTargetDto {
  return Boolean(value && typeof value.productId === 'string' && value.productId.length > 0);
}

function isTargetValue(value: CatalogOfferTarget | null): value is CatalogOfferTarget {
  return value !== null;
}

function normaliseIds(ids: string[] | undefined): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && id.length > 0) : [];
}

/** Add the family to one card without replacing the anchor's product identity. */
export function toCatalogItemFromOfferFamily(family: CatalogOfferFamily): CatalogItem {
  return {
    ...family.anchor,
    id: family.id,
    price: family.startingPrice,
    priceIsFrom: family.menuOffers.length > 0 || (family.variationOptions?.length ?? 0) > 1,
    offerFamily: family,
  };
}

/** Filter one commercial family by its orderable targets while keeping one card identity. */
export function toOfferFamilyFilterItem(family: CatalogOfferFamily): CatalogItem {
  return {
    ...toCatalogItemFromOfferFamily(family),
    filterTargets: [family.anchor, ...family.menuOffers],
  };
}
