'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchUsers, deleteStaff, updateStaff, reactivateUser } from '@/services/userService';
import { routeApiError } from '@/utils/apiFormErrors';
import type { UserDto, UpdateStaffCommand } from '@/types/user';

/** What every action here hands back: a flag, and a sentence that is ready to render as-is. */
export interface MemberActionResult {
  readonly success: boolean;
  readonly message: string;
}

/**
 * The server's own sentence for one failed call, or a translated fallback when it authored none.
 *
 * No field matchers: this screen has no form to route per-field messages onto, so everything the
 * server said lands in `rootMessage` — and `null` there means it said nothing worth showing.
 */
const failureMessage = (failure: unknown, fallback: string): string => routeApiError(failure).rootMessage || fallback;

/**
 * Every message this hook returns is a translated SENTENCE — never an i18n key, never a hardcoded
 * English literal (E9, #383; same defect class as `useCategoryManagement`).
 *
 * **Why the sentence has to be finished here.** `ResultModal` renders its `message` prop raw
 * (`<p>{message}</p>`, no `t`), so anything unfinished reaches the admin verbatim. The page used to
 * compensate with `setResultModalMessage(t(result.message || '…'))` — running a finished sentence
 * back through `t()`, which is a LOOKUP, and i18next loses the sentence two ways: it splits on
 * `nsSeparator` (`':'`, never overridden in `src/i18n.ts`) for text that does not look like natural
 * language, and it RESOLVES text that collides with one of the 2400+ keys. `page.test.tsx` pins
 * both. **A server sentence must never go through `t()`.**
 *
 * **Why `routeApiError` and not `getErrorMessage`.** All four calls below can fail in two shapes:
 * `apiClient` THROWS `ApiError` on a non-2xx, and a handler failure wrapped in
 * `Ok(ApiResponse.Failure(...))` RESOLVES with `{success:false}` inside a 200 — and
 * `UserController` returns `Ok(result)` for update/delete/reactivate, so the resolved shape is the
 * NORMAL failure here, not an edge case. `routeApiError` reads the server's `errors[]` out of
 * either one and drops blank entries; `getErrorMessage` sees only the thrown shape, which is why
 * the sibling menu hooks pair it with a hand-rolled `errors[].join(', ')` for the resolved one.
 * One helper, both shapes, already tested (`apiFormErrors.test.ts`).
 */
export const useMemberManagement = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getUsers = useCallback(
    async (role: string, showDeleted: boolean, searchTerm: string, page: number, pageSize: number) => {
      setIsLoading(true);
      setError(null);
      const fallback = t('failed_to_load_users', 'Failed to load users');
      try {
        const data = await fetchUsers(role, showDeleted, searchTerm, page, pageSize);
        if (data.success && data.data) {
          const fetchedUsers = data.data.items;
          // The staff tab asks for every role and filters customers out client-side; the customers
          // tab asks the server for `Customer` directly.
          setUsers(role === '' ? fetchedUsers.filter((user) => user.role !== 'Customer') : fetchedUsers);
          setTotalCount(data.data.totalCount);
        } else {
          setError(failureMessage(data, fallback));
        }
      } catch (e) {
        setError(failureMessage(e, fallback));
      } finally {
        setIsLoading(false);
      }
    },
    // `t` changes identity only on a language switch. `useCategoryManagement` (#403) reads it
    // through a ref so that switch cannot re-fire its mount effect and refetch AT PAGE 1, losing an
    // admin's place. This hook does not need the indirection: the page passes `page` as an ARGUMENT
    // rather than this callback capturing it, so a re-fire reloads the page they are already on.
    [t],
  );

  const handleDeleteUser = async (userId: string, permanent: boolean = false): Promise<MemberActionResult> => {
    const deleted = permanent
      ? t('user_permanently_deleted', 'User permanently deleted')
      : t('user_deleted_successfully', 'User deleted successfully');
    try {
      const data = await deleteStaff(userId, permanent);
      // The page used to print `deleted` whichever way this went — so a refused delete read as
      // "User deleted successfully" under `ResultModal`'s red "Error" heading.
      return data.success
        ? { success: true, message: deleted }
        : { success: false, message: failureMessage(data, t('failed_to_delete_user', 'Failed to delete user')) };
    } catch (e) {
      const fallback = t('delete_user_error', 'An error occurred while deleting user');
      return { success: false, message: failureMessage(e, fallback) };
    }
  };

  const handleReactivateUser = async (userId: string): Promise<MemberActionResult> => {
    try {
      const data = await reactivateUser(userId);
      return data.success
        ? { success: true, message: t('user_reactivated_successfully', 'User reactivated successfully') }
        : {
            success: false,
            message: failureMessage(data, t('failed_to_reactivate_user', 'Failed to reactivate user')),
          };
    } catch (e) {
      const fallback = t('reactivate_user_error', 'An error occurred while reactivating user');
      return { success: false, message: failureMessage(e, fallback) };
    }
  };

  const handleUpdateUser = async (
    user: UserDto,
    updates: Partial<UserDto>,
    newPassword?: string,
  ): Promise<MemberActionResult> => {
    // Only staff/admin users can be updated by admin
    if (user.role === 'Customer') {
      return {
        success: false,
        message: t('customers_update_own_profile_only', 'Customers can only update their own profile'),
      };
    }

    const command: UpdateStaffCommand = {
      userId: user.id,
      firstName: updates.firstName ?? user.firstName,
      lastName: updates.lastName ?? user.lastName,
      email: updates.email ?? user.email,
      phoneNumber: updates.phoneNumber ?? user.phoneNumber,
      role: updates.role ?? user.role,
      password: newPassword,
    };

    try {
      const data = await updateStaff(command);
      return data.success
        ? { success: true, message: t('user_updated_successfully', 'User updated successfully') }
        : { success: false, message: failureMessage(data, t('failed_to_update_user', 'Failed to update user')) };
    } catch (e) {
      const fallback = t('update_user_error', 'An error occurred while updating user');
      return { success: false, message: failureMessage(e, fallback) };
    }
  };

  return {
    users,
    totalCount,
    isLoading,
    error,
    getUsers,
    handleDeleteUser,
    handleUpdateUser,
    handleReactivateUser,
  };
};
