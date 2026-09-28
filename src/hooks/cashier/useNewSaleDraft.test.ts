import { act, renderHook, waitFor } from '@testing-library/react';
import { useNewSaleDraft } from './useNewSaleDraft';
import { OrderType } from '@/types/order';
import { persistCashierNewSaleDraft } from '@/lib/cashierNewSaleDraft';

const enabled = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];
const tableId = '11111111-1111-1111-1111-111111111111';
const serviceSessionId = '22222222-2222-2222-2222-222222222222';

function atUrl(path: string) {
  window.history.replaceState({}, '', path);
}

async function renderDraft() {
  const rendered = renderHook(() => useNewSaleDraft(enabled, false));
  await waitFor(() => expect(rendered.result.current.state.channel).not.toBeNull());
  return rendered;
}

describe('useNewSaleDraft — the Add-round entry deep link', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    atUrl('/cashier/new');
  });

  afterAll(() => atUrl('/'));

  it('preselects dine-in and the table from ?channel=DineIn&table=N, exactly once', async () => {
    atUrl('/cashier/new?channel=DineIn&table=7');
    const { result, rerender } = await renderDraft();

    expect(result.current.state.channel).toBe(OrderType.DineIn);
    expect(result.current.state.tableNumber).toBe('7');

    await act(async () => {
      rerender();
    });
    // A second pass (param still in the URL) must not fight a later manual change.
    await act(async () => {
      result.current.setTableNumber('9');
    });
    await act(async () => {
      rerender();
    });
    expect(result.current.state.tableNumber).toBe('9');
  });

  it('ignores a table the parser cannot accept', async () => {
    atUrl('/cashier/new?channel=DineIn&table=abc');
    const { result } = await renderDraft();

    expect(result.current.state.channel).toBe(OrderType.Takeaway);
    expect(result.current.state.tableNumber).toBe('');
  });

  it('preselects a lettered table with an open visit and drops the IDs after manual editing', async () => {
    atUrl(`/cashier/new?channel=DineIn&table=11a&tableId=${tableId}&serviceSessionId=${serviceSessionId}`);
    const { result } = await renderDraft();

    expect(result.current.state).toMatchObject({
      channel: OrderType.DineIn,
      tableNumber: '11a',
      tableId,
      serviceSessionId,
    });
    act(() => result.current.setTableNumber('11b'));
    expect(result.current.state.tableNumber).toBe('11b');
    expect(result.current.state.tableId).toBeUndefined();
    expect(result.current.state.serviceSessionId).toBeUndefined();
  });

  it('keeps an unfinished sale for another visit instead of silently moving its lines', async () => {
    persistCashierNewSaleDraft({
      channel: OrderType.DineIn,
      lines: [{ product: { id: 'coffee', name: 'Coffee' }, quantity: 1, unitPrice: 3 }],
      tableLabel: '12a',
      tableId: '33333333-3333-3333-3333-333333333333',
      serviceSessionId: '44444444-4444-4444-4444-444444444444',
    });
    atUrl(`/cashier/new?channel=DineIn&table=11a&tableId=${tableId}&serviceSessionId=${serviceSessionId}`);
    const { result } = await renderDraft();

    expect(result.current.entryConflict).toBe(true);
    expect(result.current.state.tableNumber).toBe('12a');
    expect(result.current.state.lines[0].product.id).toBe('coffee');
    expect(result.current.state.serviceSessionId).toBe('44444444-4444-4444-4444-444444444444');
    act(() => result.current.setLineQuantity(0, 2));
    expect(result.current.entryConflict).toBe(true);
    expect(result.current.state.tableNumber).toBe('12a');
  });

  it('ignores the entry link when dine-in is not enabled for the tenant', async () => {
    atUrl('/cashier/new?channel=DineIn&table=7');
    const rendered = renderHook(() => useNewSaleDraft([OrderType.Takeaway, OrderType.Delivery], false));
    await waitFor(() => expect(rendered.result.current.state.channel).not.toBeNull());

    expect(rendered.result.current.state.channel).toBe(OrderType.Takeaway);
    expect(rendered.result.current.state.tableNumber).toBe('');
  });

  it('does nothing without entry params', async () => {
    const { result } = await renderDraft();

    expect(result.current.state.channel).toBe(OrderType.Takeaway);
    expect(result.current.state.tableNumber).toBe('');
  });
});
