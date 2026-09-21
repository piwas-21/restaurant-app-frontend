import {
  SERVER_TAKEAWAY_DRAFT_VERSION,
  clearServerTakeawayDraft,
  persistServerTakeawayDraft,
  readServerTakeawayDraft,
  type ServerTakeawayDraft,
} from './serverTakeawayDraft';

const draft: ServerTakeawayDraft = {
  items: [
    {
      product: { id: 'p1', name: 'Burger' },
      quantity: 1,
      unitPrice: 12,
      notes: 'no onions',
      addedIngredients: [{ id: 'i1', name: 'Bacon', price: 2, quantity: 1 }],
      removedIngredients: [{ id: 'i2', name: 'Pickle', price: 0, quantity: 1 }],
      sideItems: [{ id: 's1', name: 'Fries', quantity: 1, price: 4 }],
      selectedIngredientIds: ['i1'],
      ingredientQuantities: { i1: 1 },
    },
  ],
  notes: 'Call customer',
  clientOperationId: 'op-1',
};

beforeEach(() => {
  window.sessionStorage.clear();
});

describe('serverTakeawayDraft', () => {
  it('round-trips the ticket, customizations, notes and operation id', () => {
    persistServerTakeawayDraft(draft);

    expect(readServerTakeawayDraft()).toEqual(draft);
  });

  it('drops malformed customization rows instead of trusting session storage', () => {
    window.sessionStorage.setItem(
      'server.takeaway-draft',
      JSON.stringify({
        version: SERVER_TAKEAWAY_DRAFT_VERSION,
        items: [
          {
            ...draft.items[0],
            addedIngredients: [{ id: 'i1', name: 'Bacon', price: 'free' }],
            sideItems: [{ id: 's1', name: 'Fries', quantity: 1 }],
          },
        ],
      }),
    );

    const restored = readServerTakeawayDraft();
    expect(restored?.items[0].addedIngredients).toBeUndefined();
    expect(restored?.items[0].sideItems).toBeUndefined();
  });

  it('ignores a draft written by another version and clears committed state', () => {
    window.sessionStorage.setItem('server.takeaway-draft', JSON.stringify({ version: 99, items: [] }));
    expect(readServerTakeawayDraft()).toBeNull();

    persistServerTakeawayDraft(draft);
    clearServerTakeawayDraft();
    expect(readServerTakeawayDraft()).toBeNull();
  });
});
