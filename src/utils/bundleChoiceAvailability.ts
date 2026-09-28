import type { Product } from '@/app/admin/menu-management/interfaces';
import type { MenuSection } from '@/types/menu';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES, isStorableMask, orderTypesFromMask } from '@/utils/orderChannels';

export interface BundleSectionChannelCount {
  readonly orderType: OrderType;
  readonly orderableCount: number;
  readonly minimum: number;
  readonly meetsMinimum: boolean;
}

export interface BundleOptionAvailability {
  readonly productId: string;
  readonly productVariationId: string | null;
  readonly isActive: boolean;
  readonly isAvailable: boolean;
  readonly isActiveVariation: boolean;
  readonly allowedOrderTypes: readonly OrderType[];
}

export interface BundleSectionAvailability {
  readonly sectionId: string;
  readonly sectionName: string;
  readonly isRequired: boolean;
  readonly minimum: number;
  readonly channels: readonly BundleSectionChannelCount[];
  readonly options: readonly BundleOptionAvailability[];
}

export interface BundleChoiceAvailabilityAssessment {
  readonly sections: readonly BundleSectionAvailability[];
  readonly warnings: readonly BundleChoiceAvailabilityWarning[];
}

export interface BundleChoiceAvailabilityWarning {
  readonly sectionId: string;
  readonly sectionName: string;
  readonly orderType: OrderType;
  readonly minimum: number;
  readonly orderableCount: number;
}

export type BundleChoiceAvailabilityResult =
  | { readonly status: 'ready'; readonly assessment: BundleChoiceAvailabilityAssessment }
  | { readonly status: 'incomplete' };

export type BundleParentOrderTypesResult =
  { readonly status: 'ready'; readonly orderTypes: readonly OrderType[] } | { readonly status: 'incomplete' };

/** Resolve local explicit channels or inherit the freshly loaded server value for an existing bundle. */
export function resolveBundleParentOrderTypes(
  availableOrderTypes: number | null | undefined,
  parentProductId: string | null | undefined,
  products: readonly Product[],
): BundleParentOrderTypesResult {
  if (typeof availableOrderTypes === 'number') {
    if (!Number.isInteger(availableOrderTypes) || !isStorableMask(availableOrderTypes)) {
      return { status: 'incomplete' };
    }
    return { status: 'ready', orderTypes: orderTypesFromMask(availableOrderTypes) };
  }

  if (parentProductId == null || parentProductId.length === 0) {
    return { status: 'ready', orderTypes: [...ALL_ORDER_TYPES] };
  }

  const parent = products.find((product) => product.id === parentProductId);
  if (!hasFreshAvailability(parent) || parent.availability.allowedOrderTypes.length === 0) {
    return { status: 'incomplete' };
  }
  return { status: 'ready', orderTypes: parent.availability.allowedOrderTypes };
}

/** Count distinct, active, available choices allowed on each enabled parent channel. */
export function assessBundleChoiceAvailability(
  sections: readonly MenuSection[],
  parentOrderTypes: readonly OrderType[],
  products: readonly Product[],
): BundleChoiceAvailabilityResult {
  const productsById = new Map(products.map((product) => [product.id, product]));
  const referencedProductIds = new Set(sections.flatMap((section) => section.items.map((item) => item.productId)));
  if ([...referencedProductIds].some((productId) => !hasFreshAvailability(productsById.get(productId)))) {
    return { status: 'incomplete' };
  }

  const sectionAvailability = sections.map((section) => {
    const channels = parentOrderTypes.map((orderType) => {
      const orderableProductIds = new Set(
        section.items
          .filter((item) => {
            const product = productsById.get(item.productId);
            return (
              Boolean(
                product?.isActive && product.isAvailable && product.availability?.allowedOrderTypes.includes(orderType),
              ) && isActiveVariation(product, item.productVariationId)
            );
          })
          .map((item) => item.productId),
      );
      const orderableCount = orderableProductIds.size;
      return {
        orderType,
        orderableCount,
        minimum: section.minSelection,
        meetsMinimum: orderableCount >= section.minSelection,
      };
    });

    return {
      sectionId: section.id,
      sectionName: section.name,
      isRequired: section.isRequired,
      minimum: section.minSelection,
      channels,
      options: [
        ...new Map(section.items.map((item) => [choiceKey(item.productId, item.productVariationId), item])).values(),
      ].map((item) => {
        const product = productsById.get(item.productId);
        return {
          productId: item.productId,
          productVariationId: item.productVariationId ?? null,
          isActive: product?.isActive ?? false,
          isAvailable: product?.isAvailable ?? false,
          isActiveVariation: isActiveVariation(product, item.productVariationId),
          allowedOrderTypes: product?.availability?.allowedOrderTypes ?? [],
        };
      }),
    };
  });

  const warnings = sectionAvailability.flatMap((section) =>
    section.isRequired
      ? section.channels
          .filter((channel) => !channel.meetsMinimum)
          .map((channel) => ({
            sectionId: section.sectionId,
            sectionName: section.sectionName,
            orderType: channel.orderType,
            minimum: section.minimum,
            orderableCount: channel.orderableCount,
          }))
      : [],
  );

  return { status: 'ready', assessment: { sections: sectionAvailability, warnings } };
}

function choiceKey(productId: string, productVariationId: string | null | undefined): string {
  return `${productId}::${productVariationId ?? 'base'}`;
}

function isActiveVariation(product: Product | undefined, productVariationId: string | null | undefined): boolean {
  if (productVariationId == null) return true;
  return Boolean(product?.variations?.some((variation) => variation.id === productVariationId && variation.isActive));
}

function hasFreshAvailability(product: Product | undefined): product is Product & {
  availability: NonNullable<Product['availability']>;
} {
  return Boolean(
    product &&
    typeof product.isActive === 'boolean' &&
    typeof product.isAvailable === 'boolean' &&
    Array.isArray(product.availability?.allowedOrderTypes) &&
    product.availability.allowedOrderTypes.every((orderType) => ALL_ORDER_TYPES.includes(orderType)) &&
    new Set(product.availability.allowedOrderTypes).size === product.availability.allowedOrderTypes.length,
  );
}
