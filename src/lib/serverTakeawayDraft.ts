import type { OrderItem } from '@/components/catalog/orderItems';

export const SERVER_TAKEAWAY_DRAFT_VERSION = 1;
const STORAGE_KEY = 'server.takeaway-draft';

export interface ServerTakeawayDraft {
  readonly items: OrderItem[];
  readonly notes?: string;
  readonly clientOperationId?: string;
}

interface StoredDraft {
  readonly version?: unknown;
  readonly items?: unknown;
  readonly notes?: unknown;
  readonly clientOperationId?: unknown;
}

type IngredientChange = NonNullable<OrderItem['addedIngredients']>[number];
type SideItem = NonNullable<OrderItem['sideItems']>[number];
type IngredientRow = { id: string; name: string; price: number; quantity: number };

function isIngredientRow(value: unknown): value is IngredientRow {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.price === 'number' &&
    Number.isFinite(row.price) &&
    typeof row.quantity === 'number' &&
    Number.isInteger(row.quantity) &&
    row.quantity > 0
  );
}

function readIngredientChanges(value: unknown): IngredientChange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const changes = value.filter(isIngredientRow);
  return changes.length > 0
    ? changes.map((entry) => ({
        id: entry.id,
        name: entry.name,
        price: entry.price,
        quantity: entry.quantity,
      }))
    : undefined;
}

function readSideItems(value: unknown): SideItem[] | undefined {
  return readIngredientChanges(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readItem(value: unknown): OrderItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const product = row.product;
  if (typeof product !== 'object' || product === null) return null;
  const productRow = product as Record<string, unknown>;
  if (
    typeof productRow.id !== 'string' ||
    productRow.id.trim() === '' ||
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
    variationId: optionalString(row.variationId),
    variationName: optionalString(row.variationName),
    notes: optionalString(row.notes),
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
    addedIngredients: readIngredientChanges(row.addedIngredients),
    removedIngredients: readIngredientChanges(row.removedIngredients),
    sideItems: readSideItems(row.sideItems),
    unitPrice: row.unitPrice,
  };
}

export function readServerTakeawayDraft(): ServerTakeawayDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as StoredDraft;
    if (stored.version !== SERVER_TAKEAWAY_DRAFT_VERSION || !Array.isArray(stored.items)) return null;
    const items = stored.items.map(readItem).filter((item): item is OrderItem => item !== null);
    return {
      items,
      notes: optionalString(stored.notes),
      clientOperationId: optionalString(stored.clientOperationId),
    };
  } catch (_error: unknown) {
    return null;
  }
}

export function persistServerTakeawayDraft(draft: ServerTakeawayDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SERVER_TAKEAWAY_DRAFT_VERSION, ...draft }));
  } catch (_error: unknown) {
    // Storage is best effort; the in-memory ticket remains usable.
  }
}

export function clearServerTakeawayDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (_error: unknown) {
    // Storage is best effort; the committed order is authoritative.
  }
}
