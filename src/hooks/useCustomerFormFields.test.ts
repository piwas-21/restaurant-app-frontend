import { renderHook, waitFor } from '@testing-library/react';
import { useCustomerFormFields, invalidateFormFieldConfigCache } from './useCustomerFormFields';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS } from '@/types/formFieldConfig';
import type { FormFieldsDto } from '@/types/formFieldConfig';

const mockGetAll = jest.fn();
jest.mock('@/services/formFieldConfigService', () => ({
  formFieldConfigService: { getAll: () => mockGetAll() },
}));

const served: FormFieldsDto[] = [
  {
    formKey: 'reservation',
    fields: [
      { fieldKey: 'customerName', isVisible: true, isRequired: true, isLocked: true, displayOrder: 0 },
      { fieldKey: 'customerEmail', isVisible: true, isRequired: true, isLocked: true, displayOrder: 1 },
      { fieldKey: 'customerPhone', isVisible: true, isRequired: true, isLocked: false, displayOrder: 2 },
      { fieldKey: 'specialRequests', isVisible: false, isRequired: false, isLocked: false, displayOrder: 3 },
    ],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  invalidateFormFieldConfigCache();
});

describe('useCustomerFormFields', () => {
  it('serves the fetched rules for the requested form', async () => {
    mockGetAll.mockResolvedValue(served);
    const { result } = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rules.customerPhone).toEqual({ isVisible: true, isRequired: true });
    expect(result.current.rules.specialRequests).toEqual({ isVisible: false, isRequired: false });
  });

  it('falls back to the defaults when the fetch fails (a broken endpoint never breaks the form)', async () => {
    mockGetAll.mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rules).toEqual(DEFAULT_FORM_FIELD_RULES.reservation);
  });

  it('falls back to the defaults on an empty configuration', async () => {
    mockGetAll.mockResolvedValue([]);
    const { result } = renderHook(() => useCustomerFormFields(FORM_KEYS.checkoutContact));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rules).toEqual(DEFAULT_FORM_FIELD_RULES.checkout_contact);
  });

  it('falls back to the defaults when the response lacks the requested form', async () => {
    mockGetAll.mockResolvedValue(served); // only `reservation` is present
    const { result } = renderHook(() => useCustomerFormFields(FORM_KEYS.deliveryAddress));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rules).toEqual(DEFAULT_FORM_FIELD_RULES.delivery_address);
  });

  it('shares one request across concurrent consumers via the module cache', async () => {
    mockGetAll.mockResolvedValue(served);
    const first = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));
    const second = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it('refetches after the cache is invalidated (admin save flow)', async () => {
    mockGetAll.mockResolvedValue(served);
    const first = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    invalidateFormFieldConfigCache();
    const second = renderHook(() => useCustomerFormFields(FORM_KEYS.reservation));
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(mockGetAll).toHaveBeenCalledTimes(2);
  });
});
