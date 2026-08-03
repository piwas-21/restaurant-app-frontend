import { act, renderHook, waitFor } from '@testing-library/react';
import { useDeliveryAddress } from './useDeliveryAddress';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses, createAddress } from '@/services/addressService';
import { ApiError } from '@/utils/apiClient';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, f?: string) => f ?? k }),
}));
jest.mock('@/services/userService', () => ({
  getCurrentUser: jest.fn().mockRejectedValue(new Error('guest')),
}));
jest.mock('@/services/addressService', () => ({
  getMyAddresses: jest.fn().mockResolvedValue([]),
  createAddress: jest.fn(),
}));

const mockedUser = getCurrentUser as jest.Mock;
const mockedAddresses = getMyAddresses as jest.Mock;
const mockedCreate = createAddress as jest.Mock;

const DEFAULTS = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.deliveryAddress];
let mockRules: FormFieldRules = DEFAULTS;
jest.mock('@/hooks/useCustomerFormFields', () => ({
  useCustomerFormFields: () => ({ rules: mockRules, loading: false }),
}));

const VALID = { street: 'Rue du Rhône 1', city: 'Genève', postalCode: '1204' };

const fillLockedFields = (result: { current: ReturnType<typeof useDeliveryAddress> }) => {
  act(() => {
    result.current.setStreet(VALID.street);
    result.current.setCity(VALID.city);
    result.current.setPostalCode(VALID.postalCode);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRules = DEFAULTS;
  mockedUser.mockRejectedValue(new Error('guest'));
  mockedAddresses.mockResolvedValue([]);
});

describe('useDeliveryAddress — schema built from the admin config (D3)', () => {
  it('keeps today’s behaviour under the default rules (country/additionalInfo optional)', () => {
    const { result } = renderHook(() => useDeliveryAddress());
    fillLockedFields(result);
    act(() => result.current.setCountry(''));

    let valid = false;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(true);
    expect(result.current.addressError).toBe('');
  });

  it('still enforces the locked fields (empty street → i18n key surfaced)', () => {
    const { result } = renderHook(() => useDeliveryAddress());
    let valid = true;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(false);
    // t(key, key) with the mocked t returns the key itself.
    expect(result.current.addressError).toBe('street_required');
  });

  it('enforces a config-required country', () => {
    mockRules = { ...DEFAULTS, country: { isVisible: true, isRequired: true } };
    const { result } = renderHook(() => useDeliveryAddress());
    fillLockedFields(result);
    act(() => result.current.setCountry('  '));

    let valid = true;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(false);
    expect(result.current.addressError).toBe('validation_field_required');
  });

  it('a hidden country keeps its Switzerland default so the payload stays valid', () => {
    mockRules = { ...DEFAULTS, country: { isVisible: false, isRequired: false } };
    const { result } = renderHook(() => useDeliveryAddress());
    fillLockedFields(result);

    let valid = false;
    act(() => {
      valid = result.current.validate();
    });
    expect(valid).toBe(true);
    expect(result.current.trimmed()).toEqual({
      ...VALID,
      country: 'Switzerland',
      additionalInfo: '',
    });
  });

  it('exposes the config rules for the section’s visibility/markers', () => {
    mockRules = { ...DEFAULTS, additionalInfo: { isVisible: false, isRequired: false } };
    const { result } = renderHook(() => useDeliveryAddress());
    expect(result.current.fieldRules.additionalInfo).toEqual({ isVisible: false, isRequired: false });
  });
});

/**
 * The saved-addresses effect used to wrap BOTH calls in one catch, justified by "logged-out users
 * still proceed via the manual form" — true of `getCurrentUser`, which 401s for every guest, and
 * false of `getMyAddresses`, which only runs once that has succeeded. A logged-in customer whose
 * address list failed was therefore marked logged OUT: the list vanished silently and, because
 * `persistIfRequested` is gated on `isLoggedIn`, so did the save-this-address behaviour.
 */
describe('useDeliveryAddress — a failed address list is not a logged-out session', () => {
  it('stays silent for a guest, whose profile call is expected to fail', async () => {
    const { result } = renderHook(() => useDeliveryAddress(undefined, true));

    await waitFor(() => expect(result.current.showNewAddressForm).toBe(true));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.addressError).toBe('');
  });

  it('keeps the session AND says why when only the address list fails', async () => {
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedAddresses.mockRejectedValue(new ApiError(500, '', ['Address book is unavailable']));

    const { result } = renderHook(() => useDeliveryAddress(undefined, true));

    await waitFor(() => expect(result.current.addressError).toBe('Address book is unavailable'));
    // The half that silently disabled "save this address" for the rest of checkout.
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.showNewAddressForm).toBe(true);
    expect(result.current.loadingAddresses).toBe(false);
  });

  it('falls back to the translated sentence when the server authored none', async () => {
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedAddresses.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useDeliveryAddress(undefined, true));

    await waitFor(() => expect(result.current.addressError).toBe('Could not load your saved addresses.'));
    expect(result.current.isLoggedIn).toBe(true);
  });

  it('loads the list normally when nothing fails', async () => {
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedAddresses.mockResolvedValue([
      { id: 'a1', addressLine1: 'Rue du Rhône 1', city: 'Genève', postalCode: '1204', country: 'Switzerland' },
    ]);

    const { result } = renderHook(() => useDeliveryAddress(undefined, true));

    await waitFor(() => expect(result.current.savedAddresses).toHaveLength(1));
    expect(result.current.addressError).toBe('');
    expect(result.current.showNewAddressForm).toBe(false);
  });
});

describe('useDeliveryAddress — saving an address surfaces the refusal', () => {
  const saveWith = async (rejection: unknown) => {
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedCreate.mockRejectedValue(rejection);
    const { result } = renderHook(() => useDeliveryAddress(undefined, true));
    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    fillLockedFields(result);
    act(() => result.current.setSaveThisAddress(true));
    let ok = true;
    await act(async () => {
      ok = await result.current.persistIfRequested();
    });
    return { result, ok };
  };

  it("shows the server's reason rather than the generic", async () => {
    const { result, ok } = await saveWith(new ApiError(400, '', ['That label is already in use']));

    expect(ok).toBe(false);
    expect(result.current.addressError).toBe('That label is already in use');
  });

  it('shows the translated generic for a client-side throw', async () => {
    const { result, ok } = await saveWith(new TypeError('Failed to fetch'));

    expect(ok).toBe(false);
    expect(result.current.addressError).toBe('Failed to save address. Please try again.');
  });
});
