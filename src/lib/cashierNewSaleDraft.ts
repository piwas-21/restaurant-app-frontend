import type { OrderType } from '@/types/order';

/**
 * The one unsent counter-sale draft (cashier POS redesign plan §5.3.7).
 *
 * Modelled on `cashierPendingPayment.ts`: sessionStorage, a defensive reader that treats a
 * corrupted or foreign payload as "no draft", and writes that are best effort — a blocked
 * storage area must never stop the till from selling. Exactly ONE draft exists per device,
 * and it survives navigation between the workspace destinations; it is cleared when its
 * order is created (the created order then lives at the collection route).
 *
 * The store is VERSIONED. A stored draft whose version is not the current one is dropped on
 * read, never merged — a draft the code cannot reason about exactly is a draft that could
 * post a line the cashier did not see. The lines are the serialized projection of the shared
 * catalog `OrderItem` (bundle-free: the counter path adds products, not menu parents).
 */

export const CASHIER_NEW_SALE_DRAFT_VERSION = 1;

const STORAGE_KEY = 'cashier.new-sale-draft';

/** The line identity the ticket renders and the payload builder prices. */
export interface CashierNewSaleDraftLineProduct {
  readonly id: string;
  readonly name: string;
}

export interface CashierNewSaleDraftLine {
  product: CashierNewSaleDraftLineProduct;
  quantity: number;
  variationId?: string;
  variationName?: string;
  notes?: string;
  addedIngredients?: Array<{ id: string; name: string; price: number; quantity: number }>;
  removedIngredients?: Array<{ id: string; name: string; price: number; quantity: number }>;
  selectedIngredientIds?: string[];
  ingredientQuantities?: Record<string, number>;
  sideItems?: Array<{ id: string; name: string; quantity: number; price: number }>;
  unitPrice: number;
}

export interface CashierNewSaleDraft {
  /** Channel the sale is entered on. A change here is a NEW quote, never a silent repricing. */
  channel: OrderType;
  lines: CashierNewSaleDraftLine[];
  /**
   * The create operation key, minted on the first create attempt and reused for every retry
   * of the SAME payload; reset whenever the draft content changes. Reusing it with a changed
   * payload is refused by the server instead of replayed, so the reset is load-bearing.
   */
  clientOperationId?: string;
}

interface StoredDraft {
  readonly version?: unknown;
  readonly channel?: unknown;
  readonly lines?: unknown;
  readonly clientOperationId?: unknown;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toLine(value: unknown): CashierNewSaleDraftLine | null {
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
    ingredientQuantities:
      typeof line.ingredientQuantities === 'object' && line.ingredientQuantities !== null
        ? (line.ingredientQuantities as Record<string, number>)
        : undefined,
    unitPrice: line.unitPrice,
  };
}

const VALID_CHANNELS: ReadonlySet<string> = new Set(['DineIn', 'Takeaway', 'Delivery']);

/** Read the draft after a navigation or a reload; anything unrecognizable reads as none. */
export function readCashierNewSaleDraft(): CashierNewSaleDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const stored = parsed as StoredDraft;
    if (stored.version !== CASHIER_NEW_SALE_DRAFT_VERSION) return null;
    if (typeof stored.channel !== 'string' || !VALID_CHANNELS.has(stored.channel)) return null;
    if (!Array.isArray(stored.lines)) return null;
    const lines = stored.lines.map(toLine).filter((line): line is CashierNewSaleDraftLine => line !== null);
    return {
      channel: stored.channel as CashierNewSaleDraft['channel'],
      lines,
      clientOperationId: asOptionalString(stored.clientOperationId),
    };
  } catch (_error) {
    // A corrupted or unreadable draft must behave like no draft; the ticket starts empty.
    return null;
  }
}

/** Persist the exact draft so navigation between the workspace destinations keeps the ticket. */
export function persistCashierNewSaleDraft(draft: CashierNewSaleDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CASHIER_NEW_SALE_DRAFT_VERSION, ...draft }));
  } catch (_error) {
    // A blocked storage area must not prevent the sale; the ticket keeps working in memory.
  }
}

/** Clear the draft — after its order is created, or when the cashier empties the ticket. */
export function clearCashierNewSaleDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (_error) {
    // Storage is best effort; an unclearable draft is an in-memory ticket, not a broken till.
  }
}
