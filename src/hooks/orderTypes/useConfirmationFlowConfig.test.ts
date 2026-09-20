import { createElement, StrictMode, type ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useConfirmationFlowConfig, flowLookup } from './useConfirmationFlowConfig';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';

jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getPublicConfirmationConfigurations: jest.fn() },
}));

const mockGet = orderTypeConfigurationService.getPublicConfirmationConfigurations as jest.Mock;

const rows = [
  { orderType: 'Takeaway', confirmationFlow: 'acknowledge', reviewWindowMinutes: 2 },
  { orderType: 'Delivery', confirmationFlow: 'direct', reviewWindowMinutes: 2 },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useConfirmationFlowConfig', () => {
  it('settles under React StrictMode effect replay', async () => {
    mockGet.mockResolvedValue(rows);
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);

    const { result } = renderHook(() => useConfirmationFlowConfig(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.flowByType?.get('Takeaway')?.flow).toBe('acknowledge');
  });

  it('maps rows per order type and keeps the acknowledge window', async () => {
    mockGet.mockResolvedValue(rows);

    const { result } = renderHook(() => useConfirmationFlowConfig());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.flowByType?.get('Takeaway')).toEqual({ flow: 'acknowledge', reviewWindowMinutes: 2 });
    expect(result.current.flowByType?.get('Delivery')).toEqual({ flow: 'direct', reviewWindowMinutes: 2 });
  });

  it('reads an unparseable flow as direct and a missing window as the default', async () => {
    mockGet.mockResolvedValue([{ orderType: 'Takeaway', confirmationFlow: 'SOMETHING_ELSE' }]);

    const { result } = renderHook(() => useConfirmationFlowConfig());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.flowByType?.get('Takeaway')).toEqual({ flow: 'direct', reviewWindowMinutes: 2 });
  });

  it('keeps the config unavailable (null) when the public read fails', async () => {
    mockGet.mockRejectedValue(new Error('down'));

    const { result } = renderHook(() => useConfirmationFlowConfig());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.flowByType).toBeNull();
  });
});

describe('flowLookup', () => {
  it('answers null for an unknown type and for a missing map', () => {
    expect(flowLookup(null)('Takeaway')).toBeNull();
    const map = new Map([['Takeaway', { flow: 'acknowledge' as const, reviewWindowMinutes: 5 }]]);
    expect(flowLookup(map)('Delivery')).toBeNull();
    expect(flowLookup(map)('Takeaway')).toEqual({ flow: 'acknowledge', reviewWindowMinutes: 5 });
  });
});
