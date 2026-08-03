/**
 * The dev portal's failure line.
 *
 * Two legs land in one `catch` and they fail in different shapes: `fetchDiagnostics` goes through
 * `apiClient` and yields an `ApiError`; `fetchVersion` uses raw `fetch` and throws a plain `Error`
 * whose message ("version endpoint returned 502") IS the finding. `getErrorMessage` returns null
 * for the second by design, so reading it alone would have destroyed the version leg's only signal.
 *
 * And since #401 the most important failure here has NO words at all — a dead backend is
 * `ApiError(0, '')`, and "Unknown error" is the least useful thing a panel whose job is answering
 * "is the backend up?" could say. `status` and `cause` are on the error and now get shown.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { apiClient, ApiError } from '@/utils/apiClient';
import { useDevPortalData } from './useDevPortalData';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

/** Drive the diagnostics leg (the `apiClient` one) and read back what it printed. */
async function diagnosticsErrorFor(failure: unknown): Promise<string | null> {
  mockGet.mockRejectedValue(failure);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as unknown as Response);

  const { result } = renderHook(() => useDevPortalData());
  await waitFor(() => expect(result.current.diagnostics.loading).toBe(false));
  return result.current.diagnostics.error;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('the diagnostics leg', () => {
  it("shows the server's sentence, with the status alongside it — the old line dropped the status", async () => {
    await expect(diagnosticsErrorFor(new ApiError(503, 'diagnostics disabled'))).resolves.toBe(
      'diagnostics disabled (HTTP 503)',
    );
  });

  it('says "network unreachable" rather than "Unknown error" for a dead backend', async () => {
    // The whole point: `ApiError(0, '')` has no words, and this is the panel that most needs them.
    const line = await diagnosticsErrorFor(
      new ApiError(0, '', undefined, undefined, { cause: new TypeError('Failed to fetch') }),
    );

    expect(line).toBe('network unreachable — TypeError: Failed to fetch');
  });

  it('surfaces the cause of an HTML 502, which used to be discarded entirely', async () => {
    const cause = new SyntaxError(`Unexpected token '<'`);
    const line = await diagnosticsErrorFor(new ApiError(500, '', undefined, undefined, { cause }));

    expect(line).toBe(`HTTP 500 — SyntaxError: Unexpected token '<'`);
  });

  it('falls back only when there is genuinely nothing — not an ApiError, not an Error', async () => {
    await expect(diagnosticsErrorFor('a bare string')).resolves.toBe('Unknown error');
  });
});

describe('the version leg', () => {
  it("keeps the plain Error's message, which IS the diagnostic there", async () => {
    // `fetchVersion` uses raw `fetch`, so `getErrorMessage` returns null for its throw. Reading
    // only `getErrorMessage` would have printed "Unknown error" and lost the status entirely.
    mockGet.mockResolvedValue({});
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 } as unknown as Response);

    const { result } = renderHook(() => useDevPortalData());
    await waitFor(() => expect(result.current.version.loading).toBe(false));

    expect(result.current.version.error).toBe('version endpoint returned 502');
  });
});
