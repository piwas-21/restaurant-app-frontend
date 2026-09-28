import type { CashierNewSaleDraftLine } from './cashierNewSaleDraft';

export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toIngredientChanges(
  value: unknown,
): Array<{ id: string; name: string; price: number; quantity: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const changes = value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.price !== 'number' ||
      typeof row.quantity !== 'number'
    ) {
      return [];
    }
    return [{ id: row.id, name: row.name, price: row.price, quantity: row.quantity }];
  });
  return changes.length > 0 ? changes : undefined;
}

function toSideItems(value: unknown): Array<{ id: string; name: string; quantity: number; price: number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const sides = value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.quantity !== 'number' ||
      typeof row.price !== 'number'
    ) {
      return [];
    }
    return [{ id: row.id, name: row.name, quantity: row.quantity, price: row.price }];
  });
  return sides.length > 0 ? sides : undefined;
}

function toIngredientQuantities(value: unknown): Record<string, number> | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function toLine(value: unknown): CashierNewSaleDraftLine | null {
  if (typeof value !== 'object' || value === null) return null;
  const line = value as Record<string, unknown>;
  const product = line.product as Record<string, unknown> | undefined;
  if (
    typeof product?.id !== 'string' ||
    product.id.trim().length === 0 ||
    typeof product.name !== 'string' ||
    typeof line.quantity !== 'number' ||
    !Number.isInteger(line.quantity) ||
    line.quantity <= 0 ||
    typeof line.unitPrice !== 'number' ||
    !Number.isFinite(line.unitPrice)
  ) {
    return null;
  }
  return {
    product: { id: product.id, name: product.name },
    quantity: line.quantity,
    variationId: asOptionalString(line.variationId),
    variationName: asOptionalString(line.variationName),
    notes: asOptionalString(line.notes),
    selectedIngredientIds: Array.isArray(line.selectedIngredientIds)
      ? line.selectedIngredientIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    ingredientQuantities: toIngredientQuantities(line.ingredientQuantities),
    addedIngredients: toIngredientChanges(line.addedIngredients),
    removedIngredients: toIngredientChanges(line.removedIngredients),
    sideItems: toSideItems(line.sideItems),
    unitPrice: line.unitPrice,
  };
}
