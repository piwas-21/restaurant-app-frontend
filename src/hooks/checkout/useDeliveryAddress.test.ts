import { act, renderHook } from '@testing-library/react';
import { useDeliveryAddress } from './useDeliveryAddress';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';

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
