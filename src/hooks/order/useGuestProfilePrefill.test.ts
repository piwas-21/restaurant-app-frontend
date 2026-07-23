import { renderHook, waitFor } from '@testing-library/react';
import { useGuestProfilePrefill } from './useGuestProfilePrefill';
import { mergeContactFieldRules } from '@/lib/checkout/contactFieldRules';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS } from '@/types/formFieldConfig';
import { UserRole, type UserDto } from '@/types/user';
import type { CustomerInfoField } from '@/components/order/GuestCustomerInfoFields';

const mockGetCurrentUser = jest.fn();
jest.mock('@/services/userService', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

const FULL_FIELDS: ReadonlyArray<CustomerInfoField> = ['name', 'email', 'phone'];

const baseUser: UserDto = {
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  phoneNumber: '+41221234567',
  role: UserRole.Customer,
  isEmailConfirmed: true,
  createdAt: '2026-01-01T00:00:00Z',
  isDeleted: false,
  metadata: {},
  orderLimitAmount: 0,
  discountPercentage: 0,
  isDiscountActive: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe('useGuestProfilePrefill — narrowing over the merged shown set', () => {
  it('guests keep every collected field visible and pre-fill from saved info', async () => {
    localStorage.setItem('rumi_saved_customer_info', JSON.stringify({ name: 'Ada', email: 'ada@example.com' }));
    const { result } = renderHook(() => useGuestProfilePrefill(true, FULL_FIELDS));

    await waitFor(() => expect(result.current.isLoadingUser).toBe(false));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.visibleFields).toEqual(['name', 'email', 'phone']);
    expect(result.current.prefill).toEqual({ name: 'Ada', email: 'ada@example.com', phone: '' });
  });

  it('narrows away every field a complete profile pre-fills', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockGetCurrentUser.mockResolvedValue(baseUser);
    const { result } = renderHook(() => useGuestProfilePrefill(true, FULL_FIELDS));

    await waitFor(() => expect(result.current.isLoadingUser).toBe(false));
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.visibleFields).toEqual([]);
    expect(result.current.prefill.phone).toBe('+41221234567');
  });

  it('keeps only the fields the profile is missing (no phone on file → phone stays)', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, phoneNumber: '' });
    const { result } = renderHook(() => useGuestProfilePrefill(true, FULL_FIELDS));

    await waitFor(() => expect(result.current.isLoadingUser).toBe(false));
    expect(result.current.visibleFields).toEqual(['phone']);
  });

  it('composes with mergeContactFieldRules: a config-shown optional phone still narrows away when on file', async () => {
    localStorage.setItem('auth_token', 'tok');
    mockGetCurrentUser.mockResolvedValue(baseUser);
    // DineIn floor + default config → phone shown as optional (D3 merge).
    const merged = mergeContactFieldRules(['name', 'email'], DEFAULT_FORM_FIELD_RULES[FORM_KEYS.checkoutContact]);
    expect(merged.fields).toEqual(['name', 'email', 'phone']);

    const { result } = renderHook(() => useGuestProfilePrefill(true, merged.fields));
    await waitFor(() => expect(result.current.isLoadingUser).toBe(false));
    expect(result.current.visibleFields).toEqual([]);
  });

  it('does not fetch while disabled (modal closed)', () => {
    localStorage.setItem('auth_token', 'tok');
    const { result } = renderHook(() => useGuestProfilePrefill(false, FULL_FIELDS));
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    // Pre-resolution the narrowing passes the collected set through.
    expect(result.current.visibleFields).toEqual(['name', 'email', 'phone']);
  });
});
