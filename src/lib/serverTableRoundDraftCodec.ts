import type { OrderItem } from '@/components/catalog/orderItems';

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readBundle(value: unknown): OrderItem['bundle'] | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const bundle = value as Record<string, unknown>;
  if (!Array.isArray(bundle.sections) || !Array.isArray(bundle.selectedOptions)) return undefined;
  const validSections = bundle.sections.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const section = entry as Record<string, unknown>;
    return (
      typeof section.id === 'string' &&
      Array.isArray(section.items) &&
      section.items.every((item) => {
        if (typeof item !== 'object' || item === null) return false;
        const row = item as Record<string, unknown>;
        return typeof row.productId === 'string' && typeof row.additionalPrice === 'number';
      })
    );
  });
  const validOptions = bundle.selectedOptions.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false;
    const option = entry as Record<string, unknown>;
    return (
      typeof option.sectionId === 'string' &&
      typeof option.itemId === 'string' &&
      typeof option.quantity === 'number' &&
      Number.isInteger(option.quantity) &&
      option.quantity > 0
    );
  });
  return validSections && validOptions ? (value as OrderItem['bundle']) : undefined;
}

type IngredientRow = { id: string; name: string; price: number; quantity: number };

function readIngredientRows(value: unknown): IngredientRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((entry): entry is IngredientRow => {
    if (typeof entry !== 'object' || entry === null) return false;
    const row = entry as Record<string, unknown>;
    return (
      typeof row.id === 'string' &&
      typeof row.name === 'string' &&
      typeof row.price === 'number' &&
      Number.isFinite(row.price) &&
      typeof row.quantity === 'number' &&
      Number.isInteger(row.quantity) &&
      row.quantity > 0
    );
  });
  return result.length ? result : undefined;
}

function readItem(value: unknown): OrderItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const product = row.product;
  if (typeof product !== 'object' || product === null) return null;
  const productRow = product as Record<string, unknown>;
  if (
    typeof productRow.id !== 'string' ||
    typeof productRow.name !== 'string' ||
    typeof row.quantity !== 'number' ||
    !Number.isInteger(row.quantity) ||
    row.quantity <= 0 ||
    typeof row.unitPrice !== 'number' ||
    !Number.isFinite(row.unitPrice)
  ) {
    return null;
  }
  return {
    product: { id: productRow.id, name: productRow.name },
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    variationId: text(row.variationId),
    variationName: text(row.variationName),
    notes: text(row.notes),
    selectedIngredientIds: Array.isArray(row.selectedIngredientIds)
      ? row.selectedIngredientIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    ingredientQuantities:
      typeof row.ingredientQuantities === 'object' && row.ingredientQuantities !== null
        ? Object.fromEntries(
            Object.entries(row.ingredientQuantities).filter(
              (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
            ),
          )
        : undefined,
    addedIngredients: readIngredientRows(row.addedIngredients),
    removedIngredients: readIngredientRows(row.removedIngredients),
    sideItems: readIngredientRows(row.sideItems),
    bundle: readBundle(row.bundle),
  };
}

export function decodeServerTableRoundItems(value: unknown[]): OrderItem[] {
  return value.map(readItem).filter((item): item is OrderItem => item !== null);
}
