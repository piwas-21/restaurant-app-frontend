/**
 * GAP-2 S6 — the language preference that survives the device.
 *
 * `Accept-Language` covers the row a guest is creating right now; this covers everything after it —
 * the password reset they ask for from a hotel computer, the receipt for an order placed on a phone
 * whose browser is set to something else (§1 rank 2, which OUTRANKS the header). The write is
 * best-effort by construction: the UI language has already changed when this runs, so a failure
 * here must be silent, must not undo it, and must not end the session.
 */

import { saveLanguagePreference } from './userService';
import { apiClient, ApiError } from '@/utils/apiClient';

jest.mock('@/utils/apiClient');

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;

const profile = {
  id: 'u1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '+41791112233',
  preferredLanguage: 'en',
};

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('stores the new language on the account', async () => {
  get.mockResolvedValue({ data: profile });
  put.mockResolvedValue({ data: { ...profile, preferredLanguage: 'fr' } });

  await expect(saveLanguagePreference('fr')).resolves.toBe(true);

  expect(put).toHaveBeenCalledWith(
    '/api/User/profile',
    {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phoneNumber: '+41791112233',
      preferredLanguage: 'fr',
    },
    { signOutOn401: false },
  );
});

/**
 * `PUT /profile` is a whole-profile write, and the fields it leaves alone are the ones it is not
 * sent: the handler assigns `Metadata` only when present. Sending an empty one here would erase it.
 */
it('sends no metadata, so the account keeps whatever it has', async () => {
  get.mockResolvedValue({ data: { ...profile, metadata: { loyaltyTier: 'gold' } } });
  put.mockResolvedValue({ data: {} });

  await saveLanguagePreference('fr');

  expect(put.mock.calls[0][1]).not.toHaveProperty('metadata');
});

/**
 * The names are re-read rather than taken from the auth context precisely because this PUT
 * overwrites them: posting a cached copy would revert a rename made in another tab.
 */
it('posts the names the server currently holds, not a cached copy', async () => {
  get.mockResolvedValue({ data: { ...profile, firstName: 'Augusta', preferredLanguage: 'en' } });
  put.mockResolvedValue({ data: {} });

  await saveLanguagePreference('de');

  expect(put).toHaveBeenCalledWith(
    '/api/User/profile',
    expect.objectContaining({ firstName: 'Augusta' }),
    expect.anything(),
  );
});

it('writes nothing when the account already says that', async () => {
  get.mockResolvedValue({ data: { ...profile, preferredLanguage: 'fr' } });

  await expect(saveLanguagePreference('fr')).resolves.toBe(true);

  expect(put).not.toHaveBeenCalled();
});

/**
 * Two quick clicks are two independent GET→PUT pairs, and the network decides which PUT lands last.
 * Without a last-click-wins guard the account can end up on a language the UI is not showing — the
 * "the setting does not stick" failure, arrived at from the other direction.
 */
it('a second choice made while the first is in flight wins', async () => {
  let releaseFirstRead: (value: unknown) => void = () => {};
  get.mockImplementationOnce(() => new Promise((resolve) => (releaseFirstRead = resolve)));
  get.mockResolvedValue({ data: profile });
  put.mockResolvedValue({ data: {} });

  const first = saveLanguagePreference('fr');
  await saveLanguagePreference('de');
  releaseFirstRead({ data: profile });
  await first;

  expect(put).toHaveBeenCalledTimes(1);
  expect(put.mock.calls[0][1]).toMatchObject({ preferredLanguage: 'de' });
});

/**
 * A dead session must be REPORTED, not acted on: `signOutOn401: false` is what keeps a menu click
 * from clearing storage and navigating a diner away from a half-filled checkout form.
 */
it('never lets a background write end the session', async () => {
  get.mockRejectedValue(new ApiError(401, ''));

  await expect(saveLanguagePreference('fr')).resolves.toBe(false);

  expect(get).toHaveBeenCalledWith('/api/User/profile', { signOutOn401: false });
});

it.each([
  ['a write the server refused', 'fr'],
  ['a dead network', 'de'],
])('reports failure quietly on %s', async (_case, language) => {
  get.mockResolvedValue({ data: profile });
  put.mockRejectedValue(new ApiError(400, 'Unsupported language'));

  await expect(saveLanguagePreference(language)).resolves.toBe(false);
});
