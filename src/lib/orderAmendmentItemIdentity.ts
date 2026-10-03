export interface AmendmentItemIdentity {
  readonly productId: string;
  readonly menuId: string;
  readonly productVariationId: string;
}

/** Read both the frontend's menuId and the backend's acronym-preserving menuID wire name. */
export function amendmentItemIdentity(value: unknown): AmendmentItemIdentity {
  const item = asRecord(value);
  return {
    productId: readId(item.productId) ?? readId(item.ProductId) ?? '',
    menuId: readId(item.menuId) ?? readId(item.menuID) ?? readId(item.MenuId) ?? readId(item.MenuID) ?? '',
    productVariationId: readId(item.productVariationId) ?? readId(item.ProductVariationId) ?? '',
  };
}

/** Match exactly one catalog identity, without assuming a product-backed menu line. */
export function sameAmendmentItemIdentity(expected: unknown, actual: unknown): boolean {
  const expectedId = amendmentItemIdentity(expected);
  const actualId = amendmentItemIdentity(actual);
  const sameMenu = expectedId.menuId.toLowerCase() === actualId.menuId.toLowerCase();
  const sameVariation = expectedId.productVariationId.toLowerCase() === actualId.productVariationId.toLowerCase();
  if (expectedId.productId) {
    return expectedId.productId.toLowerCase() === actualId.productId.toLowerCase() && sameMenu && sameVariation;
  }

  return Boolean(expectedId.menuId) && !actualId.productId && sameMenu && sameVariation;
}

function readId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
