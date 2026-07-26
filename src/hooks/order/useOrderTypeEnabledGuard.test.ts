import { renderHook } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { useOrderTypeEnabledGuard } from './useOrderTypeEnabledGuard';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';

jest.mock('@/contexts/OrderTypeContext', () => ({ useOrderType: jest.fn() }));
jest.mock('@/hooks/checkout/useEnabledOrderTypes', () => ({ useEnabledOrderTypes: jest.fn() }));

const mockUseOrderType = useOrderType as jest.Mock;
const mockUseEnabled = useEnabledOrderTypes as jest.Mock;

const setOrderType = jest.fn();
const clearOrderType = jest.fn();

const arrange = (orderType: OrderType | null, enabled: OrderType[], loading = false) => {
  mockUseOrderType.mockReturnValue({ state: { orderType }, setOrderType, clearOrderType });
  mockUseEnabled.mockReturnValue({ enabled, loading });
  renderHook(() => useOrderTypeEnabledGuard());
};

const ALL = [OrderType.DineIn, OrderType.Takeaway, OrderType.Delivery];

beforeEach(() => jest.clearAllMocks());

describe('useOrderTypeEnabledGuard', () => {
  // G4 — the picker only hides the button; the stored choice stayed in force.
  it('clears a stored type the restaurant no longer offers', () => {
    arrange(OrderType.Delivery, [OrderType.DineIn, OrderType.Takeaway]);

    expect(clearOrderType).toHaveBeenCalledTimes(1);
    expect(setOrderType).not.toHaveBeenCalled();
  });

  it('leaves a stored type that is still offered alone', () => {
    arrange(OrderType.Takeaway, ALL);

    expect(clearOrderType).not.toHaveBeenCalled();
    expect(setOrderType).not.toHaveBeenCalled();
  });

  // G8 — a delivery-only restaurant made the guest click a button with no alternative.
  it('selects the only enabled type when nothing is chosen', () => {
    arrange(null, [OrderType.Delivery]);

    expect(setOrderType).toHaveBeenCalledWith(OrderType.Delivery);
  });

  it('does not auto-select when more than one type is on offer', () => {
    arrange(null, [OrderType.Takeaway, OrderType.Delivery]);

    expect(setOrderType).not.toHaveBeenCalled();
  });

  it('does not auto-select over a choice the guest already made', () => {
    arrange(OrderType.Takeaway, [OrderType.Takeaway]);

    expect(setOrderType).not.toHaveBeenCalled();
    expect(clearOrderType).not.toHaveBeenCalled();
  });

  // The hook starts at `enabled: []`; acting on that would wipe every guest's choice on load.
  it('does nothing while the enabled list is still loading', () => {
    arrange(OrderType.Delivery, [], true);

    expect(clearOrderType).not.toHaveBeenCalled();
    expect(setOrderType).not.toHaveBeenCalled();
  });

  it('does nothing when the enabled list resolves empty', () => {
    arrange(OrderType.Delivery, []);

    expect(clearOrderType).not.toHaveBeenCalled();
    expect(setOrderType).not.toHaveBeenCalled();
  });
});
