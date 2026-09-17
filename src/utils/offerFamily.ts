import type {
  CatalogOfferFamily,
  CatalogOfferFamilyDto,
  CatalogOfferSummaryDto,
  CatalogOfferTarget,
  CatalogOfferTargetDto,
  CatalogOfferAvailabilityDto,
} from '@/types/menu/offerFamily';
import type { AvailabilityReason, CatalogItem, ItemAvailability, MenuItemImage } from '@/types/menu';
import { OrderType } from '@/types/order';
import { FALLBACK_IMAGE } from '@/utils/imageHelpers';

const parsePrice = (value: number | string | undefined): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value ?? '0');
  return Number.isFinite(parsed) ? parsed : 0;
};

const ORDER_TYPES = new Set(Object.values(OrderType));
const AVAILABILITY_REASONS = new Set<AvailabilityReason>(['Available', 'Unavailable', 'WrongOrderType']);

function mapAvailability(dto: CatalogOfferAvailabilityDto | undefined): ItemAvailability | undefined {
  if (!dto || !Array.isArray(dto.allowedOrderTypes)) return undefined;
  const allowedOrderTypes = dto.allowedOrderTypes.filter((value): value is OrderType =>
    ORDER_TYPES.has(value as OrderType),
  );
  if (allowedOrderTypes.length === 0) return undefined;
  const canOrder = dto.canOrder !== false;
  const reason = AVAILABILITY_REASONS.has(dto.reason as AvailabilityReason)
    ? (dto.reason as AvailabilityReason)
    : canOrder
      ? 'Available'
      : 'WrongOrderType';
  return { canOrder, reason, allowedOrderTypes };
}

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
  const type = summary.type?.toLowerCase();
  return summary.isBundle === true || summary.kind === 'bundle' || summary.kind === 'menu' || type === 'menu';
}

function mapImages(images: CatalogOfferSummaryDto['images'], fallbackAlt: string): MenuItemImage[] | undefined {
  if (!Array.isArray(images)) return undefined;
  const mapped = images
    .filter((image) => typeof image?.url === 'string' && image.url.length > 0)
    .sort(
      (left, right) =>
        Number(right.isPrimary === true) - Number(left.isPrimary === true) ||
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0),
    )
    .map((image) => ({
      url: image.url as string,
      cardUrl: image.cardUrl?.trim() || undefined,
      alt: image.altText?.trim() || fallbackAlt,
    }));
  return mapped.length > 0 ? mapped : undefined;
}

function primaryImage(images: MenuItemImage[] | undefined): string | undefined {
  return images?.[0]?.url;
}

function toCardSummary(summary: CatalogOfferSummaryDto, id: string): CatalogItem | null {
  const name = summary.name?.trim();
  if (!name) return null;
  const isBundle = isBundleSummary(summary);
  const images = mapImages(summary.images, name);
  return {
    kind: isBundle ? 'bundle' : 'product',
    id,
    name,
    description: summary.description ?? undefined,
    content: mapContent(summary.content, name),
    imageUrl: summary.imageUrl || images?.[0]?.cardUrl || primaryImage(images) || FALLBACK_IMAGE,
    imageCount: images?.length,
    images,
    price: parsePrice(summary.price ?? summary.basePrice),
    isBundle,
    priceEditability: isBundle ? 'bundle' : (summary.variations?.length ?? 0) > 0 ? 'variations' : 'editable',
    allergens: Array.isArray(summary.allergens) ? summary.allergens : [],
    isSpecial: summary.isSpecial,
    isActive: summary.isActive,
    isAvailable: summary.isAvailable,
    availability: mapAvailability(summary.availability),
    priceIsFrom: summary.hideBaseProduct === true,
  };
}

function toTarget(dto: CatalogOfferTargetDto): CatalogOfferTarget | null {
  if (!dto.productId) return null;
  // Menu-offer rows intentionally contain only the linked bundle id and pricing/availability
  // fields. The label is supplied by the localized mode choice, so a missing name is valid here.
  const name = dto.name?.trim() || '';
  return {
    productId: dto.productId,
    kind: 'bundle',
    parentVariationId: dto.parentVariationId,
    variationName: dto.variationName,
    name,
    description: dto.description,
    content: mapContent(dto.content, name),
    price: parsePrice(dto.price ?? dto.basePrice),
    imageUrl: dto.imageUrl ?? undefined,
    isActive: dto.isActive,
    isAvailable: dto.isAvailable,
    availability: mapAvailability(dto.availability),
    scheduleAvailable: dto.scheduleAvailable,
    isSpecial: dto.isSpecial,
    allergens: Array.isArray(dto.allergens) ? dto.allergens : [],
    offerMode: 'meal',
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
    visibleInAll: dto.visibleInAll,
    anchorScheduleAvailable: dto.anchorScheduleAvailable,
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
  const anchor = anchorTargetForFamily(family);
  const availableTarget = [anchor, ...family.menuOffers].find(isOfferTargetOrderable);
  const effectivePrices = effectiveOrderablePriceChoices(family);
  return {
    ...family.anchor,
    id: family.id,
    price: family.startingPrice,
    priceIsFrom: new Set(effectivePrices).size > 1,
    // A linked meal can remain orderable while its anchor is not. The card's verdict must then be
    // the valid target's verdict; otherwise `MenuCard` removes Add before the guest can choose it.
    isAvailable: Boolean(availableTarget),
    availability: cardAvailability(family, availableTarget),
    offerFamily: family,
  };
}

/**
 * Return the purchase choices a guest can actually select at this moment. The backend's catalog
 * builder uses the same gates: a visible base row (unless hidden), active variations on an
 * orderable anchor, and orderable linked menu targets. This is intentionally not a count of raw
 * DTO rows — an inactive variation or blocked menu must not turn an exact price into a misleading
 * "from" label.
 */
export function effectiveOrderablePriceChoices(family: CatalogOfferFamily): number[] {
  const anchor = anchorTargetForFamily(family);
  const prices: number[] = [];
  if (isOfferTargetOrderable(anchor)) {
    if (!family.anchor.priceIsFrom) prices.push(family.anchor.price);
    prices.push(
      ...(family.variationOptions ?? [])
        .map((variation) => variation.price)
        .filter((price): price is number => price !== undefined && Number.isFinite(price)),
    );
  }
  prices.push(...family.menuOffers.filter(isOfferTargetOrderable).map((offer) => offer.price));
  return prices.filter((price) => Number.isFinite(price));
}

/** Filter one commercial family by its orderable targets while keeping one card identity. */
export function toOfferFamilyFilterItem(family: CatalogOfferFamily): CatalogItem {
  return {
    ...toCatalogItemFromOfferFamily(family),
    filterTargets: [family.anchor, ...family.menuOffers],
  };
}

/** Build the anchor target used by both the mode sheet and the direct-open fast path. */
export function anchorTargetForFamily(family: CatalogOfferFamily): CatalogOfferTarget {
  return {
    productId: family.anchor.id,
    kind: family.anchor.isBundle ? 'bundle' : 'product',
    name: family.anchor.name,
    description: family.anchor.description,
    content: family.anchor.content,
    price: family.anchor.price,
    imageUrl: family.anchor.imageUrl,
    isActive: family.anchor.isActive,
    isAvailable: family.anchor.isAvailable,
    availability: family.anchor.availability,
    scheduleAvailable: family.anchor.isBundle ? family.anchorScheduleAvailable : undefined,
    offerMode: 'item',
    isSpecial: family.anchor.isSpecial,
    allergens: family.anchor.allergens,
  };
}

/** A target is orderable only when every server-provided gate agrees. */
export function isOfferTargetOrderable(target: CatalogOfferTarget): boolean {
  return (
    target.isActive !== false &&
    target.isAvailable !== false &&
    target.scheduleAvailable !== false &&
    target.availability?.canOrder !== false
  );
}

const ALL_ORDER_TYPES = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

function unavailableAvailability(source?: ItemAvailability): ItemAvailability {
  return source?.canOrder === false
    ? source
    : { canOrder: false, reason: 'Unavailable', allowedOrderTypes: ALL_ORDER_TYPES };
}

function cardAvailability(
  family: CatalogOfferFamily,
  availableTarget: CatalogOfferTarget | undefined,
): ItemAvailability | undefined {
  if (availableTarget) return availableTarget.availability;
  const anchor = anchorTargetForFamily(family);
  if (anchor.scheduleAvailable === false || anchor.isAvailable === false) {
    return unavailableAvailability(anchor.availability);
  }
  return anchor.availability;
}
