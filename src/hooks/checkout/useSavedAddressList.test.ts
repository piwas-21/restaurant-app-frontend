import { act, renderHook, waitFor } from '@testing-library/react';
import { useSavedAddressList } from './useSavedAddressList';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses } from '@/services/addressService';
import { ApiError } from '@/utils/apiClient';

jest.mock('@/services/userService', () => ({ getCurrentUser: jest.fn() }));
jest.mock('@/services/addressService', () => ({ getMyAddresses: jest.fn() }));
// ONE object for the whole file, mirroring the real `useStableT`'s `useRef`. Returning a fresh
// object per render instead makes it a new value in the effect's `[enabled, tRef]` deps, so every
// state write remounts the effect — measured at 47 `getCurrentUser` calls in 200ms, with each test
// then racing a spinning effect. `useStableT`'s own doc names this family of bug.
const stableT = { current: (_key: string, fallback?: string) => fallback ?? _key };
jest.mock('@/hooks/useStableT', () => ({ useStableT: () => stableT }));

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

    // The settle has to be forced, and this is the whole reason: `isLoggedIn: false`,
    // `savedAddresses: []`, `showNewAddressForm: true` and `listError: null` are ALSO the initial
    // state, so a `waitFor` on any of them returns before the effect has run and every assertion
    // below passes whatever the catch does. An earlier draft did exactly that and survived deleting
    // the fix. Waiting on the CALL, then flushing the rejection's microtasks, is what makes the
    // `listError` assertion mean something.
    await waitFor(() => expect(mockedUser).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.savedAddresses).toEqual([]);
    // Silence is right here: every guest at checkout produces this, and a message would be noise on
    // the intended path. This is the assertion the non-auth branch could break.
    expect(result.current.listError).toBeNull();
  });

  it('does not call the address list at all for a guest', async () => {
    mockedUser.mockRejectedValue(new ApiError(401, ''));

    renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(mockedUser).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockedAddresses).not.toHaveBeenCalled();
  });

  it('does nothing at all until enabled', async () => {
    // `enabled` is false for most of checkout; the effect must not fire a profile call then.
    renderHook(() => useSavedAddressList(false));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedUser).not.toHaveBeenCalled();
  });

  it('treats a null user as a guest', async () => {
    // `getCurrentUser` resolving falsy is a distinct path from it throwing.
    mockedUser.mockResolvedValue(null);

    const { result } = renderHook(() => useSavedAddressList(true));

    await waitFor(() => expect(mockedUser).toHaveBeenCalled());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.listError).toBeNull();
    expect(mockedAddresses).not.toHaveBeenCalled();
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
