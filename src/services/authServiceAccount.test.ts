import { apiClient, ApiError } from '@/utils/apiClient';
import { confirmAccountDeletion, forgotPassword, requestAccountDeletion } from './authService';

// `jest.spyOn`, deliberately NOT a bare `jest.mock('@/utils/apiClient')`. That AUTOMOCKS: measured
// here, the resulting `ApiError` keeps only its prototype — `instanceof` passes while `status`,
// `errors` and `errorCode` all read `undefined` and the constructor body never runs. Every
// assertion below would still be green while testing nothing, in precisely the dimension #414 is
// about (the status). `userService.test.ts` hit the same trap from the other side, where
// automocking turned `isAuthError` into a `jest.fn()` returning `undefined`, and works around it
// with a `jest.requireActual` factory.
//
// What this does NOT do is keep the real module: `__mocks__/@/utils/apiClient.ts` shadows
// `@/utils/apiClient` tree-wide with no `jest.mock()` call, so `apiClient.post` is already a
// `jest.fn()` before the spy and `ApiError` here is the hand-written double. The double mirrors the
// real constructor faithfully, which is what makes `.status` readable and these assertions real —
// but nothing in this file exercises `apiClient`'s own 401-refresh, redirect, or error
// construction. Those are covered by `apiClientRequest.test.ts` against the real module.
const mockedPost = jest.spyOn(apiClient, 'post');

/**
 * Issue #414. These three helpers were raw `fetch` calls ending in `return response.json()` for
 * EVERY status, so the status was discarded before anyone could read it.
 *
 * The user-visible case was `POST /api/User/request-deletion`, which is `[Authorize]`: a customer
 * whose token expired while the account page was open clicked "Delete My Account", `.json()` threw
 * a `SyntaxError` on the empty 401 body, and they read "An unexpected error occurred." — so they
 * retried forever, when the answer was "sign in again". Going through `apiClient` is what makes the
 * status available: it refreshes and retries a 401, and signs a genuinely dead session out to the
 * login route.
 *
 * These assert the WIRING, because that is what carries the fix — the request config is the
 * difference between a status the client can act on and one it never sees.
 */
describe('authService account helpers go through apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedPost.mockResolvedValue({ success: true });
  });

  it('forgotPassword posts the command and returns the envelope', async () => {
    mockedPost.mockResolvedValue({ success: true, message: 'ok' });

    await expect(forgotPassword({ email: 'a@b.com' })).resolves.toEqual({ success: true, message: 'ok' });

    expect(mockedPost).toHaveBeenCalledWith('/api/Auth/forgot-password', { email: 'a@b.com' });
  });

  it('requestAccountDeletion requires auth, so a missing token never reaches the network', async () => {
    // The load-bearing assertion for #414. `requireAuth` makes `apiClient` throw ApiError(401)
    // before sending, instead of posting anonymously and leaving the client to interpret the 401
    // the server returns.
    await requestAccountDeletion();

    expect(mockedPost).toHaveBeenCalledWith('/api/User/request-deletion', undefined, { requireAuth: true });
  });

  it('confirmAccountDeletion does NOT require auth — it is followed from a mail client', async () => {
    // `[AllowAnonymous]`; it authenticates by the emailed token in the body. Requiring a stored
    // session here would break the one flow that cannot assume one.
    await confirmAccountDeletion({ userId: 'u1', token: 't1' });

    expect(mockedPost).toHaveBeenCalledWith('/api/User/confirm-deletion', { userId: 'u1', token: 't1' });
    expect(mockedPost.mock.calls[0][2]).toBeUndefined();
  });

  it.each([
    ['forgotPassword', () => forgotPassword({ email: 'a@b.com' })],
    ['requestAccountDeletion', () => requestAccountDeletion()],
    ['confirmAccountDeletion', () => confirmAccountDeletion({ userId: 'u1', token: 't1' })],
  ])('%s propagates the status instead of swallowing it', async (_name, invoke) => {
    // The regression these replace: a raw `fetch` resolved for every status, so a 401/429/502 was
    // indistinguishable from success until `.json()` happened to throw on an empty body — by which
    // point the status was gone.
    mockedPost.mockRejectedValue(new ApiError(401, ''));

    const thrown = await invoke().catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ApiError);
    // The status is the point — it is what the raw `fetch` discarded.
    expect((thrown as ApiError).status).toBe(401);
  });

  it('still resolves a 200 that carries success:false', async () => {
    // All three controllers `return Ok(result)`, so a handler-level refusal is an HTTP 200 with a
    // failure envelope. `apiClient` does not throw on 2xx, so the callers' existing `success ===
    // false` branches stay live — this conversion is additive, not a replacement for them.
    mockedPost.mockResolvedValue({ success: false, errors: ['Invalid or expired deletion token'] });

    await expect(confirmAccountDeletion({ userId: 'u1', token: 't1' })).resolves.toMatchObject({
      success: false,
    });
  });
});
