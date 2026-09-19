import { act, renderHook, waitFor } from '@testing-library/react';
import { useNewSaleDraft } from './useNewSaleDraft';
import { OrderType } from '@/types/order';

const enabled = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

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
