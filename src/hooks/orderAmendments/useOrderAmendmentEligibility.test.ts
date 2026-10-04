import { act, renderHook, waitFor } from '@testing-library/react';
import { getOrderAmendmentEligibility } from '@/services/orderAmendmentEligibilityService';
import type { OrderDto } from '@/types/order';
import { useOrderAmendmentEligibility } from './useOrderAmendmentEligibility';

jest.mock('@/services/orderAmendmentEligibilityService', () => ({ getOrderAmendmentEligibility: jest.fn() }));
const order = { id: '00000000-0000-4000-8000-000000000001', version: 7 } as OrderDto;
const eligible = {
  orderId: order.id,
  orderVersion: 7,
  accountRevision: null,
  canCreateAmendment: true,
  amendmentMode: 'Native' as const,
  reasonCode: null,
};

describe('current-version amendment entry policy', () => {
  beforeEach(() => jest.clearAllMocks());
  it('waits for current authoritative policy and holds a stale order version', async () => {
    jest.mocked(getOrderAmendmentEligibility).mockResolvedValue({ ...eligible, orderVersion: 8 });
    const { result } = renderHook(() => useOrderAmendmentEligibility(order, 'actor', true));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.reason).toBe('orderAmendments.order_changed_refresh'));
    expect(result.current.ready).toBe(false);
  });
  it('holds a legacy order without a version while policy loads and after current policy arrives', async () => {
    jest.mocked(getOrderAmendmentEligibility).mockResolvedValue(eligible);
    // Deliberately represent a legacy runtime payload that predates the required version field.
    const legacyOrder = { id: order.id } as OrderDto;
    const { result } = renderHook(() => useOrderAmendmentEligibility(legacyOrder, 'actor', true));
    expect(result.current.reason).toBe('orderAmendments.resolution_checking');
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.reason).toBe('orderAmendments.order_changed_refresh'));
    expect(result.current.ready).toBe(false);
  });
  it('keeps the locally consented marketplace supplement mode actionable', async () => {
    jest.mocked(getOrderAmendmentEligibility).mockResolvedValue({ ...eligible, amendmentMode: 'LocalSupplementOnly' });
    const { result } = renderHook(() => useOrderAmendmentEligibility(order, 'actor', true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.mode).toBe('LocalSupplementOnly');
  });
  it('drops previously eligible state while retrying and refuses a failed read', async () => {
    jest
      .mocked(getOrderAmendmentEligibility)
      .mockResolvedValueOnce(eligible)
      .mockRejectedValueOnce(new Error('private detail'));
    const { result } = renderHook(() => useOrderAmendmentEligibility(order, 'actor', true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    act(() => result.current.retry());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.reason).toBe('orderAmendments.resolution_context_failed'));
  });
  it('does not request new policy while disabled or without a resolved actor', () => {
    const { rerender } = renderHook(({ enabled, actor }) => useOrderAmendmentEligibility(order, actor, enabled), {
      initialProps: { enabled: false, actor: undefined as string | undefined },
    });
    rerender({ enabled: true, actor: undefined });
    expect(getOrderAmendmentEligibility).not.toHaveBeenCalled();
  });
  it('isolates delayed policy reads when the actor changes', async () => {
    let first: ((value: typeof eligible) => void) | undefined;
    jest
      .mocked(getOrderAmendmentEligibility)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            first = resolve;
          }),
      )
      .mockRejectedValueOnce(new Error('new actor forbidden'));
    const { result, rerender } = renderHook(({ actor }) => useOrderAmendmentEligibility(order, actor, true), {
      initialProps: { actor: 'first' },
    });
    rerender({ actor: 'second' });
    await waitFor(() => expect(result.current.reason).toBe('orderAmendments.resolution_context_failed'));
    await act(async () => first?.(eligible));
    expect(result.current.ready).toBe(false);
  });
});
