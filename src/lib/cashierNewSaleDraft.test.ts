import {
  CASHIER_NEW_SALE_DRAFT_VERSION,
  clearCashierNewSaleDraft,
  persistCashierNewSaleDraft,
  readCashierNewSaleDraft,
  type CashierNewSaleDraft,
} from './cashierNewSaleDraft';
import { OrderType } from '@/types/order';

const line = (overrides: Record<string, unknown> = {}) => ({
  product: { id: 'product-1', name: 'Espresso' },
  quantity: 2,
  unitPrice: 3.5,
  ...overrides,
});

const draft = (overrides: Partial<CashierNewSaleDraft> = {}): CashierNewSaleDraft => ({
  channel: OrderType.Takeaway,
  lines: [line()],
  ...overrides,
});

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('cashierNewSaleDraft — persist/resume', () => {
  it('reads back the exact channel and lines it persisted', () => {
    persistCashierNewSaleDraft(draft({ clientOperationId: 'op-1' }));

    expect(readCashierNewSaleDraft()).toEqual({
      channel: OrderType.Takeaway,
      lines: [line()],
      clientOperationId: 'op-1',
    });
  });

  it('survives a navigation by living in sessionStorage, not in memory', () => {
    persistCashierNewSaleDraft(draft());
    // A new "page load" for the same tab reads the same sessionStorage.
    expect(readCashierNewSaleDraft()?.lines).toHaveLength(1);
  });

  it('reads as no draft on an empty tab', () => {
    expect(readCashierNewSaleDraft()).toBeNull();
  });
});
it('round-trips a fully-populated line without dropping sides or ingredient diffs', () => {
  // B1 regression: the reader used to restore only variation/notes/ingredient-selection and
  // silently drop sideItems and the added/removed ingredient diffs — money lost on resume.
  const fullLine = line({
    product: { id: 'product-9', name: 'Burger' },
    quantity: 1,
    unitPrice: 12.5,
    variationId: 'var-2',
    variationName: 'Double',
    notes: 'no onions',
    addedIngredients: [{ id: 'ing-1', name: 'Bacon', price: 2, quantity: 1 }],
    removedIngredients: [{ id: 'ing-2', name: 'Pickles', price: 0, quantity: 0 }],
    selectedIngredientIds: ['ing-1'],
    ingredientQuantities: { 'ing-1': 1 },
    sideItems: [{ id: 'side-3', name: 'Fries', quantity: 1, price: 4.5 }],
  });
  persistCashierNewSaleDraft({ channel: OrderType.Takeaway, lines: [fullLine] });

  expect(readCashierNewSaleDraft()?.lines).toEqual([fullLine]);
});

it('defends ingredientQuantities against non-numeric values in a tampered payload', () => {
  window.sessionStorage.setItem(
    'cashier.new-sale-draft',
    JSON.stringify({
      version: CASHIER_NEW_SALE_DRAFT_VERSION,
      channel: 'Takeaway',
      lines: [
        {
          ...line(),
          ingredientQuantities: { 'ing-1': 'many', 'ing-2': 2 },
          addedIngredients: [{ id: 'ing-1', name: 'Bacon' }],
          sideItems: [{ id: 'side-3', name: 'Fries', quantity: 1, price: 4.5 }],
        },
      ],
    }),
  );

  const restored = readCashierNewSaleDraft()?.lines[0];
  // The tampered entry is dropped, the valid one survives; malformed change/side rows are
  // filtered out entirely rather than smuggled into the wire payload.
  expect(restored?.ingredientQuantities).toEqual({ 'ing-2': 2 });
  expect(restored?.addedIngredients).toBeUndefined();
  expect(restored?.sideItems).toEqual([{ id: 'side-3', name: 'Fries', quantity: 1, price: 4.5 }]);
});

describe('cashierNewSaleDraft — defensive reading', () => {
  it.each([
    ['a foreign version', { version: 999, channel: 'Takeaway', lines: [] }],
    ['a corrupted payload', 'not json {'],
    ['an unknown channel', { version: CASHIER_NEW_SALE_DRAFT_VERSION, channel: 'Teleport', lines: [] }],
    ['a non-array lines field', { version: CASHIER_NEW_SALE_DRAFT_VERSION, channel: 'Takeaway', lines: 3 }],
  ])('drops %s instead of restoring it', (_name, payload) => {
    window.sessionStorage.setItem(
      'cashier.new-sale-draft',
      typeof payload === 'string' ? payload : JSON.stringify(payload),
    );
    expect(readCashierNewSaleDraft()).toBeNull();
  });

  it('keeps the valid lines and drops only malformed ones', () => {
    window.sessionStorage.setItem(
      'cashier.new-sale-draft',
      JSON.stringify({
        version: CASHIER_NEW_SALE_DRAFT_VERSION,
        channel: 'Takeaway',
        lines: [line(), { product: { id: 'x' }, quantity: 0, unitPrice: 1 }],
      }),
    );

    const restored = readCashierNewSaleDraft();
    expect(restored?.lines).toHaveLength(1);
    expect(restored?.lines[0]?.product.id).toBe('product-1');
  });
});

describe('cashierNewSaleDraft — clear', () => {
  it('removes the draft so the next New sale starts empty', () => {
    persistCashierNewSaleDraft(draft());
    clearCashierNewSaleDraft();

    expect(readCashierNewSaleDraft()).toBeNull();
  });

  it('clearing an empty tab stays silent', () => {
    expect(() => clearCashierNewSaleDraft()).not.toThrow();
  });
});
