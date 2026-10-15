import { act, renderHook, waitFor } from '@testing-library/react';
import { OrderType } from '@/types/order';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';
import { useEnabledOrderTypes } from './useEnabledOrderTypes';

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: jest.fn() },
}));

it('fails closed when a refresh cannot verify a previously available channel', async () => {
  const getEnabled = jest.mocked(orderTypeConfigurationService.getEnabled);
  getEnabled.mockResolvedValueOnce([OrderType.Takeaway]).mockRejectedValueOnce(new Error('offline'));
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

  try {
    const { result } = renderHook(() => useEnabledOrderTypes());
    await waitFor(() => expect(result.current).toMatchObject({ enabled: [OrderType.Takeaway], confirmed: true }));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current).toMatchObject({ enabled: [], loading: false, confirmed: false });
  } finally {
    consoleError.mockRestore();
  }
});
