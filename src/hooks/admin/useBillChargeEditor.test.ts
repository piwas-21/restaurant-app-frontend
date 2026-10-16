import { act, renderHook, waitFor } from '@testing-library/react';
import { useBillChargeEditor } from './useBillChargeEditor';
import { saveBillCharges } from '@/services/billChargeService';
import type { BillChargeConfiguration } from '@/types/billCharge';

const configuration: BillChargeConfiguration = { currency: 'CHF', rules: [] };
const mockReader = { configuration, setConfiguration: jest.fn(), refresh: jest.fn(), failed: false };
jest.mock('@/hooks/useBillChargeConfiguration', () => ({ useBillChargeConfiguration: () => mockReader }));
jest.mock('@/services/billChargeService', () => ({ saveBillCharges: jest.fn() }));
const save = jest.mocked(saveBillCharges);
beforeEach(() => jest.clearAllMocks());

it('keeps all charge presets disabled until an administrator opts in', async () => {
  const view = renderHook(() => useBillChargeEditor());
  await waitFor(() => expect(view.result.current.valid).toBe(true));
  expect(view.result.current.rules.map((rule) => [rule.key, rule.enabled])).toEqual([
    ['service_fee', false],
    ['delivery_fee', false],
  ]);
});

it('refuses duplicate keys through form submission and saves the schema-validated selection', async () => {
  save.mockResolvedValue(configuration);
  const view = renderHook(() => useBillChargeEditor());
  await waitFor(() => expect(view.result.current.valid).toBe(true));
  act(() => view.result.current.setRules((rules) => [rules[0], { ...rules[1], key: 'service_fee' }]));
  await waitFor(() => expect(view.result.current.valid).toBe(false));
  await act(() => view.result.current.save());
  expect(save).not.toHaveBeenCalled();
  act(() =>
    view.result.current.setRules((rules) => [{ ...rules[0], enabled: true, defaultAmount: 5, label: ' Service fee ' }]),
  );
  await waitFor(() => expect(view.result.current.valid).toBe(true));
  await act(() => view.result.current.save());
  expect(save).toHaveBeenCalledWith({
    currency: 'CHF',
    rules: [expect.objectContaining({ key: 'service_fee', label: 'Service fee', defaultAmount: 5 })],
  });
});
