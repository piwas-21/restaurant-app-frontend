import type { OrderType } from '@/types/order';
import { isUuid } from '@/utils/uuid';
import { readStoredContact, type CashierNewSaleContact } from './cashierNewSaleContact';
import { asOptionalString, toLine } from './cashierNewSaleDraftReader';

/**
 * The one unsent counter-sale draft (cashier POS redesign plan §5.3.7).
 *
 * Modelled on `cashierPendingPayment.ts`: sessionStorage, a defensive reader, best-effort
 * writes. Exactly ONE draft exists per device; it survives workspace navigation and is
 * cleared when its order is created (the order then lives at the collection route).
 *
 * The store is VERSIONED: a stored draft whose version is not the current one is dropped on
 * read, never merged. Lines are the serialized projection of the shared catalog `OrderItem`.
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
  /** Order-level notes for the kitchen; line notes live on the lines themselves. */
  notes?: string;
  /** Dine-in only: numeric compatibility identity and the configured display label. */
  tableNumber?: number;
  /** Exact display label and stable visit identity for lettered tables. */
  tableLabel?: string;
  tableId?: string;
  serviceSessionId?: string;
  /** Who the sale is for; delivery carries the address (see cashierNewSaleContact.ts). */
  contact?: CashierNewSaleContact;
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
  readonly notes?: unknown;
  readonly tableNumber?: unknown;
  readonly tableLabel?: unknown;
  readonly tableId?: unknown;
  readonly serviceSessionId?: unknown;
  readonly contact?: unknown;
  readonly clientOperationId?: unknown;
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
    const linkedTable = stored.channel === 'DineIn' && isUuid(stored.tableId) && isUuid(stored.serviceSessionId);
    return {
      channel: stored.channel as CashierNewSaleDraft['channel'],
      lines,
      notes: asOptionalString(stored.notes),
      tableNumber:
        typeof stored.tableNumber === 'number' && Number.isInteger(stored.tableNumber) && stored.tableNumber > 0
          ? stored.tableNumber
          : undefined,
      tableLabel: asOptionalString(stored.tableLabel),
      tableId: linkedTable ? (stored.tableId as string) : undefined,
      serviceSessionId: linkedTable ? (stored.serviceSessionId as string) : undefined,
      contact: readStoredContact(stored.contact),
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
