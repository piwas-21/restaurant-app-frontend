/**
 * GAP-2 S6 — the ONE raw `fetch` whose `Accept-Language` becomes a stored fact.
 *
 * `registerCustomer` cannot go through `apiClient` (see that module's header: a stale token would
 * turn its 401 into a sign-out mid-registration), so the header `apiClient` adds for every other
 * request has to be added here by hand — and this call is the highest-stakes one in the app for it.
 * The backend freezes what it says onto the new `ApplicationUser` (S4), and every mail that account
 * ever receives is written in it (S5), starting with the verification mail this very request
 * triggers. Omit it and the account is silently recorded as speaking the tenant's language.
 *
 * What is asserted is that registration passes THE SHARED HELPER's answer through to the wire —
 * `getRequestLanguage` itself (its i18next read, its SSR guard) is pinned in
 * `utils/apiClientLanguage.test.ts` against the real module.
 */

import { registerCustomer } from './authService';

let mockLanguage: string | null = 'tr';

jest.mock('@/utils/apiClient', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getRequestLanguage: () => mockLanguage,
}));

const payload = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  password: 'Str0ng!Passw0rd', // pragma: allowlist secret
  confirmPassword: 'Str0ng!Passw0rd', // pragma: allowlist secret
};

function headersOfLastCall(): Record<string, string> {
  const fetchMock = global.fetch as jest.Mock;
  const [, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return (init as RequestInit).headers as Record<string, string>;
}

beforeEach(() => {
  localStorage.clear();
  mockLanguage = 'tr';
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: false }),
  });
});

it('registration tells the backend which language the account speaks', async () => {
  await registerCustomer(payload);

  expect(headersOfLastCall()['Accept-Language']).toBe('tr');
  // The headers it already sent are untouched — the body still has to be read as JSON.
  expect(headersOfLastCall()['Content-Type']).toBe('application/json');
});

it('omits the header rather than sending an empty one when there is no language yet', async () => {
  mockLanguage = null;

  await registerCustomer(payload);

  expect(headersOfLastCall()).not.toHaveProperty('Accept-Language');
});
