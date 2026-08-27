import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import { useApiTokens } from './useApiTokens';

const mockEnqueue = jest.fn();
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockList = jest.fn();
const mockCreate = jest.fn();
const mockRevoke = jest.fn();
jest.mock('@/services/apiTokenService', () => ({
  apiTokenService: {
    listTokens: (...args: unknown[]) => mockList(...args),
    createToken: (...args: unknown[]) => mockCreate(...args),
    revokeToken: (...args: unknown[]) => mockRevoke(...args),
  },
}));

const request = { name: 'seeder', scopes: ['menu:read' as const], expiresInDays: 30 };

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue([]);
});

describe('useApiTokens', () => {
  it('loads the list ONCE — an unstable `t` must not turn the mount effect into a GET loop', async () => {
    const { result, rerender } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender();
    rerender();

    // The `t` this suite injects is a fresh function per render, exactly like i18next after a
    // language change. Naming it in `loadTokens`'s deps made this number grow without bound.
    expect(mockList).toHaveBeenCalledTimes(1);
  });

  it('holds the plaintext for the reveal step and forgets it on confirmation', async () => {
    mockCreate.mockResolvedValue({ id: 'a', name: 'seeder', token: 'sk_live_xyz' });
    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createToken(request);
    });
    expect(result.current.createdToken?.token).toBe('sk_live_xyz');

    act(() => result.current.dismissCreatedToken());
    // The 201 is the only copy there will ever be (plan §4) — once dismissed, the UI must not
    // be able to show it again from state it kept behind the admin's back.
    expect(result.current.createdToken).toBeNull();
  });

  it("shows the backend's own 400 reasons rather than a generic failure", async () => {
    mockCreate.mockRejectedValue(new ApiError(400, '', ['expiresInDays must be between 1 and 365']));
    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.openCreate());
    await act(async () => {
      await result.current.createToken(request);
    });

    expect(result.current.createError).toBe('expiresInDays must be between 1 and 365');
    expect(result.current.createdToken).toBeNull();
    // A refused create leaves the form OPEN, with the reason beside it — closing it would
    // throw away the scopes the admin just picked.
    expect(result.current.createOpen).toBe(true);
  });

  it('renders the JSON-binding refusal too, not just the friendly validator message', async () => {
    // Backend #414 made `expiresInDays` `[JsonRequired]`, so a body missing it is refused by the
    // DESERIALIZER — `application/problem+json` keyed on `$`, not the `ApiResponse` envelope.
    // This UI always sends the field (and `canSubmit` blocks a non-integer), so the shape should
    // never arrive; if it ever does, the admin must still get a sentence rather than silence.
    const binding =
      "JSON deserialization for type 'CreateApiTokenCommand' was missing required properties, including: expiresInDays.";
    mockCreate.mockRejectedValue(
      new ApiError(400, 'One or more validation errors occurred.', [binding], undefined, undefined, {
        $: [binding],
      }),
    );
    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createToken(request);
    });

    expect(result.current.createError).toBe(binding);
  });

  it('revokes the confirmed token and reloads the list', async () => {
    mockRevoke.mockResolvedValue(undefined);
    const token = { id: 'abc', name: 'seeder', status: 'active' as const };
    const { result } = renderHook(() => useApiTokens());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.requestRevoke(token as never));
    await act(async () => {
      await result.current.confirmRevoke();
    });

    expect(mockRevoke).toHaveBeenCalledWith('abc');
    expect(result.current.revokeTarget).toBeNull();
    expect(mockList).toHaveBeenCalledTimes(2);
  });
});
