import { apiClient } from '@/utils/apiClient';
import { hasPassword, setPassword } from './authService';

// `jest.spyOn`, not `jest.mock('@/utils/apiClient')` — see the header of `authServiceAccount.test.ts`
// for why automocking that module quietly guts `ApiError`.
const mockedGet = jest.spyOn(apiClient, 'get');
const mockedPost = jest.spyOn(apiClient, 'post');

/**
 * The two calls behind "a Google/Apple account can set its first password".
 *
 * These assert the WIRING, because the wiring is the behaviour: the request config is what decides
 * whether a background probe on the account page can end a user's session, and the path is what
 * decides whether a set reaches the endpoint that allows it.
 */
describe('authService password-provisioning helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue({ success: true, data: true });
    mockedPost.mockResolvedValue({ success: true });
  });

  it('hasPassword requires auth and returns the envelope verbatim', async () => {
    mockedGet.mockResolvedValue({ success: true, data: false });

    await expect(hasPassword()).resolves.toEqual({ success: true, data: false });

    expect(mockedGet).toHaveBeenCalledWith('/api/Auth/has-password', expect.objectContaining({ requireAuth: true }));
  });

  it('hasPassword does NOT sign the user out on a dead session', async () => {
    // Load-bearing. The account page fires this probe on mount; nobody asked for it. With the
    // default (`signOutOn401: true`), an expired token found by the probe would clear storage and
    // navigate to `/` from INSIDE apiClient — where the hook's own catch cannot stop it — throwing
    // away whatever the user was doing on the page. The reads they did ask for keep the default.
    await hasPassword();

    expect(mockedGet).toHaveBeenCalledWith('/api/Auth/has-password', { requireAuth: true, signOutOn401: false });
  });

  it('setPassword posts only the two fields, and requires auth — the user comes from the token', async () => {
    // No user id, ever: the server resolves the caller from the bearer token. Sending one would be
    // an "which account?" parameter on a password write.
    await setPassword({ newPassword: 'Str0ng!pass', confirmPassword: 'Str0ng!pass' }); // pragma: allowlist secret

    expect(mockedPost).toHaveBeenCalledWith(
      '/api/Auth/set-password',
      { newPassword: 'Str0ng!pass', confirmPassword: 'Str0ng!pass' }, // pragma: allowlist secret
      { requireAuth: true },
    );
  });
});
