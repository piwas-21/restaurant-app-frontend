import { renderHook, waitFor } from '@testing-library/react';
import { useSavedAddressList } from './useSavedAddressList';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/userService', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/services/addressService', () => ({ getMyAddresses: jest.fn() }));
jest.mock('@/hooks/useStableT', () => ({
  useStableT: () => ({ current: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const mockedUser = getCurrentUser as jest.Mock;
const mockedAddresses = getMyAddresses as jest.Mock;

/**
 * Issue #416. `getCurrentUser` rethrows EVERY `ApiError`, and this catch ran the same silent
 * `asGuest()` for all of them — so a 500, a network blip or a 429 from the per-IP `auth-refresh`
 * limiter (one NAT is a whole venue's wifi) blanked a signed-in customer's saved addresses with no
 * message. Worse, `useDeliveryAddress` gates the "save this address" checkbox on `isLoggedIn`, so
 * it then did nothing for the rest of checkout.
 *
 * The distinction is per PATH, not per callsite — which the file's own header already stated.
 */
describe('useSavedAddressList — a guest 401 vs everything else', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it('falls back SILENTLY for a guest 401 — the normal case at checkout', async () => {
    mockedUser.mockRejectedValue(new ApiError(401, ''));

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(result.current.showNewAddressForm).toBe(true));
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.savedAddresses).toEqual([]);
    // Silence is right here: every guest produces this, and a message would be noise on the
    // intended path.
    expect(result.current.listError).toBeNull();
  });

  it.each([
    [500, 'Server unavailable'],
    [429, 'Too many requests'],
  ])('SAYS SO for a %i, instead of looking like a guest (#416)', async (status, sentence) => {
    mockedUser.mockRejectedValue(new ApiError(status, sentence));

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(result.current.listError).not.toBeNull());
    // Still falls through to the manual form — checkout has to go through, and with no user object
    // there is nothing to list.
    expect(result.current.showNewAddressForm).toBe(true);
    expect(result.current.savedAddresses).toEqual([]);
    // The regression: this used to be null, so an empty list read as "I have none saved".
    expect(result.current.listError).toBe(sentence);
  });

  it('falls back to a translated sentence when the failure authored none', async () => {
    mockedUser.mockRejectedValue(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(result.current.listError).not.toBeNull());
    expect(result.current.listError).toBe('Could not load your saved addresses.');
    // A client-authored text must never reach the screen (#401/#408).
    expect(result.current.listError).not.toMatch(/Failed to fetch/);
  });

  it('loads the list for a signed-in customer', async () => {
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedAddresses.mockResolvedValue([{ id: 'a1', street: 'Rue du Rhône' }]);

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(result.current.isLoggedIn).toBe(true));
    expect(result.current.savedAddresses).toHaveLength(1);
    expect(result.current.listError).toBeNull();
  });

  it('stays logged IN when only the address list fails', async () => {
    // Unchanged behaviour, pinned alongside: the profile call already succeeded, so this is the
    // list failing rather than the session, and "you have none" and "we could not load them" are
    // different sentences.
    mockedUser.mockResolvedValue({ id: 'u1' });
    mockedAddresses.mockRejectedValue(new ApiError(500, 'Address service down'));

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(result.current.listError).not.toBeNull());
    expect(result.current.isLoggedIn).toBe(true);
    expect(result.current.listError).toBe('Address service down');
  });
});
