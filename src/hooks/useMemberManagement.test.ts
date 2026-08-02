import { act, renderHook, waitFor } from '@testing-library/react';
import { useMemberManagement } from './useMemberManagement';
import { fetchUsers, deleteStaff, updateStaff, reactivateUser } from '@/services/userService';
import { ApiError } from '@/utils/apiClient';
import type { UserDto } from '@/types/user';

jest.mock('@/services/userService');
// `t` is hoisted OUT of the factory on purpose — see `useCategoryManagement.test.ts`. react-i18next
// memoises `t` and only changes its identity on a language change; a mock that mints a fresh
// function per render does not, and `getUsers` lists `t` in its dependency array.
//
// It is a `jest.fn` rather than a plain function because it returns its own fallback: every
// client-authored sentence below is byte-identical whether the hook translated it or hardcoded the
// English, so asserting the TEXT cannot tell the two apart. Mutation-checked — replacing a
// `t(key, 'English')` with the bare `'English'` leaves every text assertion green. Asserting the
// CALL is what fails it.
const mockT = jest.fn((key: string, fallback?: string) => fallback ?? key);
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}));

/** Pins that a sentence came out of i18n rather than out of the source, per the note above. */
const expectTranslated = (key: string, sentence: string) => expect(mockT).toHaveBeenCalledWith(key, sentence);

const mockFetchUsers = fetchUsers as jest.MockedFunction<typeof fetchUsers>;
const mockDeleteStaff = deleteStaff as jest.MockedFunction<typeof deleteStaff>;
const mockUpdateStaff = updateStaff as jest.MockedFunction<typeof updateStaff>;
const mockReactivateUser = reactivateUser as jest.MockedFunction<typeof reactivateUser>;

const staffUser = { id: 'u1', role: 'Server', firstName: 'Ada', lastName: 'L' } as UserDto;
const customerUser = { id: 'u2', role: 'Customer', firstName: 'Cy', lastName: 'C' } as UserDto;

const load = async (result: { current: ReturnType<typeof useMemberManagement> }) => {
  await act(async () => {
    await result.current.getUsers('', false, '', 1, 10);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  // `routeApiError` logs every failure it routes — the only operator signal the frontend has. Keep
  // it out of the test output, but assert nothing about it: it is not this hook's contract.
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * E9 (#383). Every assertion here is about the SENTENCE that reaches the admin, not about whether a
 * catch has a binding — the ratchet already counts the latter and cannot see the former.
 *
 * The bug this suite replaced had two halves. The hook returned hardcoded English
 * ('An unexpected error occurred.', 'Customers can only update their own profile'), and the page
 * then ran whatever came back through `t()` — so a server sentence was looked up as an i18n KEY.
 */
describe('useMemberManagement — what the admin actually reads', () => {
  describe('loading the list', () => {
    it("surfaces the server's own sentence when the fetch throws", async () => {
      mockFetchUsers.mockRejectedValue(new ApiError(409, 'Directory sync is running, try again shortly'));
      const { result } = renderHook(() => useMemberManagement());

      await load(result);

      expect(result.current.error).toBe('Directory sync is running, try again shortly');
    });

    it('falls back to a CONTEXTUAL sentence, not the generic one, when the server authored none', async () => {
      mockFetchUsers.mockRejectedValue(new ApiError(500, ''));
      const { result } = renderHook(() => useMemberManagement());

      await load(result);

      // The point of E9: "Failed to load users" says where the admin is.
      expect(result.current.error).toBe('Failed to load users');
      expect(result.current.error).not.toBe('An error occurred while fetching users');
      expectTranslated('failed_to_load_users', 'Failed to load users');
    });

    /**
     * The shape `getErrorMessage` cannot read. A handler failure wrapped in
     * `Ok(ApiResponse.Failure(...))` RESOLVES inside a 200, so it never becomes a thrown `ApiError`
     * — and this branch used to print a flat 'Failed to fetch users' over whatever the server said.
     */
    it("keeps the server's sentence on the resolved {success:false} shape too", async () => {
      mockFetchUsers.mockResolvedValue({ success: false, message: 'Tenant module not enabled' } as never);
      const { result } = renderHook(() => useMemberManagement());

      await load(result);

      expect(result.current.error).toBe('Tenant module not enabled');
    });

    it("prefers the server's per-rule errors[] over its flattened message", async () => {
      mockFetchUsers.mockResolvedValue({
        success: false,
        message: 'Request failed',
        errors: ['Search term is too short', 'Page size may not exceed 100'],
      } as never);
      const { result } = renderHook(() => useMemberManagement());

      await load(result);

      expect(result.current.error).toBe('Search term is too short, Page size may not exceed 100');
    });

    it('treats a blank server message as no message at all', async () => {
      mockFetchUsers.mockResolvedValue({ success: false, message: '   ', errors: ['', '  '] } as never);
      const { result } = renderHook(() => useMemberManagement());

      await load(result);

      expect(result.current.error).toBe('Failed to load users');
    });

    it('keeps the staff tab staff-only and leaves the customers tab alone', async () => {
      mockFetchUsers.mockResolvedValue({
        success: true,
        data: { items: [staffUser, customerUser], totalCount: 2 },
      } as never);
      const { result } = renderHook(() => useMemberManagement());

      await load(result);
      expect(result.current.users).toEqual([staffUser]);
      // Pre-existing: the count is the server's, so it still counts the customer that was filtered
      // out client-side, and `Pagination` over-counts on the staff tab. Recorded, not fixed here.
      expect(result.current.totalCount).toBe(2);

      await act(async () => {
        await result.current.getUsers('Customer', false, '', 1, 10);
      });
      await waitFor(() => expect(result.current.users).toEqual([staffUser, customerUser]));
    });
  });

  describe('deleting', () => {
    it('names which kind of delete succeeded, as a sentence rather than a key', async () => {
      mockDeleteStaff.mockResolvedValue({ success: true } as never);
      const { result } = renderHook(() => useMemberManagement());

      const soft = await result.current.handleDeleteUser('u1', false);
      const permanent = await result.current.handleDeleteUser('u1', true);

      expect(soft).toEqual({ success: true, message: 'User deleted successfully' });
      expect(permanent).toEqual({ success: true, message: 'User permanently deleted' });
      expect(soft.message).not.toMatch(/^[a-z0-9_]+$/);
      expectTranslated('user_deleted_successfully', 'User deleted successfully');
      expectTranslated('user_permanently_deleted', 'User permanently deleted');
    });

    /**
     * The page used to print the success sentence whichever way this went, under `ResultModal`'s
     * red "Error" heading — a refused delete read as a completed one.
     */
    it('never returns the success sentence for a refused delete', async () => {
      mockDeleteStaff.mockResolvedValue({
        success: false,
        message: 'Delete failed',
        errors: ['User still owns 3 open orders'],
      } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleDeleteUser('u1', false);

      expect(outcome).toEqual({ success: false, message: 'User still owns 3 open orders' });
    });

    it('falls back to a contextual sentence when a refused delete says nothing', async () => {
      mockDeleteStaff.mockResolvedValue({ success: false } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleDeleteUser('u1', false);

      expect(outcome).toEqual({ success: false, message: 'Failed to delete user' });
      expectTranslated('failed_to_delete_user', 'Failed to delete user');
    });

    it('surfaces a thrown delete failure as a translated sentence, not a key', async () => {
      mockDeleteStaff.mockRejectedValue(new ApiError(500, ''));
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleDeleteUser('u1', false);

      expect(outcome).toEqual({ success: false, message: 'An error occurred while deleting user' });
      expectTranslated('delete_user_error', 'An error occurred while deleting user');
    });
  });

  describe('reactivating', () => {
    it('reports success as a sentence', async () => {
      mockReactivateUser.mockResolvedValue({ success: true } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleReactivateUser('u1');

      expect(outcome).toEqual({ success: true, message: 'User reactivated successfully' });
      expectTranslated('user_reactivated_successfully', 'User reactivated successfully');
    });

    it('never returns the success sentence for a refused reactivation', async () => {
      mockReactivateUser.mockResolvedValue({ success: false, message: 'Account is not soft-deleted' } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleReactivateUser('u1');

      expect(outcome).toEqual({ success: false, message: 'Account is not soft-deleted' });
    });

    it('falls back to a contextual sentence when a refused reactivation says nothing', async () => {
      mockReactivateUser.mockResolvedValue({ success: false } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleReactivateUser('u1');

      expect(outcome).toEqual({ success: false, message: 'Failed to reactivate user' });
      expectTranslated('failed_to_reactivate_user', 'Failed to reactivate user');
    });

    it('surfaces a thrown reactivation failure as a translated sentence', async () => {
      mockReactivateUser.mockRejectedValue(new ApiError(500, ''));
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleReactivateUser('u1');

      expect(outcome.message).toBe('An error occurred while reactivating user');
      expectTranslated('reactivate_user_error', 'An error occurred while reactivating user');
    });
  });

  describe('updating', () => {
    it('reports success as a sentence, never a bare key', async () => {
      mockUpdateStaff.mockResolvedValue({ success: true } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(staffUser, { firstName: 'Grace' });

      expect(outcome).toEqual({ success: true, message: 'User updated successfully' });
      expect(outcome.message).not.toMatch(/^[a-z0-9_]+$/);
      expectTranslated('user_updated_successfully', 'User updated successfully');
      // The command build moved out of the `try` in this change; nothing else pins its shape.
      expect(mockUpdateStaff).toHaveBeenCalledWith({
        userId: 'u1',
        firstName: 'Grace',
        lastName: 'L',
        email: undefined,
        phoneNumber: undefined,
        role: 'Server',
        password: undefined,
      });
    });

    /** Was a hardcoded English literal in the hook — CLAUDE.md §5 rule 11. */
    it('refuses a Customer with a translated sentence and sends no request', async () => {
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(customerUser, { firstName: 'Grace' });

      expect(outcome).toEqual({ success: false, message: 'Customers can only update their own profile' });
      expect(mockUpdateStaff).not.toHaveBeenCalled();
      expectTranslated('customers_update_own_profile_only', 'Customers can only update their own profile');
    });

    it("keeps the server's per-rule errors[] on a refused update", async () => {
      mockUpdateStaff.mockResolvedValue({
        success: false,
        message: 'Update failed',
        errors: ['Email already in use'],
      } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(staffUser, { email: 'taken@example.com' });

      expect(outcome).toEqual({ success: false, message: 'Email already in use' });
    });

    it('falls back to a contextual sentence when a refused update says nothing', async () => {
      mockUpdateStaff.mockResolvedValue({ success: false } as never);
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(staffUser, { firstName: 'Grace' });

      expect(outcome).toEqual({ success: false, message: 'Failed to update user' });
      expectTranslated('failed_to_update_user', 'Failed to update user');
    });

    it("surfaces the server's sentence when the update throws", async () => {
      mockUpdateStaff.mockRejectedValue(new ApiError(400, 'Role change requires an owner account'));
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(staffUser, { role: 'Admin' as UserDto['role'] });

      expect(outcome).toEqual({ success: false, message: 'Role change requires an owner account' });
    });

    it('falls back to a contextual sentence when a thrown update says nothing', async () => {
      mockUpdateStaff.mockRejectedValue(new ApiError(500, ''));
      const { result } = renderHook(() => useMemberManagement());

      const outcome = await result.current.handleUpdateUser(staffUser, { firstName: 'Grace' });

      expect(outcome.message).toBe('An error occurred while updating user');
      expectTranslated('update_user_error', 'An error occurred while updating user');
    });
  });
});
