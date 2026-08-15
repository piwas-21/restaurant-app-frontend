import { apiClient, isAuthError } from '@/utils/apiClient';
import type {
  UserDto,
  RegisterStaffCommand,
  UpdateStaffCommand,
  UpdateCustomerCommand,
  UpdateUserDiscountsCommand,
  UserStatistics,
  PagedResult,
  ApiResponse,
  UpdateUserProfileCommand,
} from '@/types/user';

// Re-export types for convenience
export type { UpdateUserProfileCommand, UserDto };

const USER_API_URL = `/api/User`;

/**
 * The subset of `apiClient`'s request config a caller of these two needs: whether a dead session
 * should be ENDED by this call. Only a background write passes it (`false`); everything a user
 * asked for keeps the default.
 */
type BackgroundCallOptions = { signOutOn401?: boolean };

/** @see saveLanguagePreference — the only writer, and the reason this is module state. */
let latestLanguageChoice: string | null = null;

/**
 * Get current user profile
 */
export async function getCurrentUser(options?: BackgroundCallOptions): Promise<UserDto> {
  try {
    const json = await apiClient.get<ApiResponse<UserDto>>(`${USER_API_URL}/profile`, options);

    if (!json.data) {
      throw new Error('Failed to fetch user profile');
    }

    return json.data;
  } catch (error) {
    // Don't log auth errors — expected for non-authenticated users during checkout. Gated on
    // the STATUS, not on the message containing 'auth': `apiClient` no longer authors
    // 'Authentication required' (#401), and a substring test never reliably asked "was this a 401?".
    if (!isAuthError(error)) {
      console.error('Error fetching user profile:', error);
    }
    throw error;
  }
}

/**
 * Update current user's profile
 */
export async function updateProfile(
  command: UpdateUserProfileCommand,
  options?: BackgroundCallOptions,
): Promise<UserDto> {
  try {
    const json = await apiClient.put<ApiResponse<UserDto>>(`${USER_API_URL}/profile`, command, options);

    if (!json.data) {
      throw new Error('Failed to update profile');
    }

    return json.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
}

/**
 * Record the language a signed-in user just chose, so their MAIL follows it too (GAP-2 §1 rank 2).
 *
 * Best-effort by construction, and the caller must treat it as such: the UI language has already
 * changed locally when this runs, and a failed write must not undo that or interrupt anyone. It is
 * also the only rank that survives the device — a guest's `Accept-Language` covers the row they are
 * creating right now, while this covers the password reset they ask for from a hotel computer next
 * month.
 *
 * The names are re-read from the server rather than taken from the auth context: `PUT /profile`
 * requires them and overwrites them, so posting a cached copy would silently revert a rename made
 * in another tab. Returns whether the preference was stored.
 */
export async function saveLanguagePreference(language: string): Promise<boolean> {
  // Last click wins. Two quick choices run two independent GET→PUT pairs, and without this the
  // second PUT can land first — leaving the account on a language the UI is not showing, which is
  // exactly the "the setting does not stick" failure the backend validator refuses to allow.
  latestLanguageChoice = language;

  try {
    // `signOutOn401: false` on both calls: nobody asked for this write. apiClient's default is to
    // end a dead session and navigate to `/`, from inside the module, where no caller's catch can
    // stop it — a menu click must not be able to throw away a half-filled checkout form.
    const current = await getCurrentUser({ signOutOn401: false });

    if (latestLanguageChoice !== language) {
      return true;
    }

    if (current.preferredLanguage === language) {
      return true;
    }

    await updateProfile(
      {
        firstName: current.firstName,
        lastName: current.lastName,
        phoneNumber: current.phoneNumber,
        preferredLanguage: language,
      },
      { signOutOn401: false },
    );

    return true;
  } catch (error) {
    // Not surfaced: nobody asked for this write, and the switcher's own job already succeeded.
    console.warn('Could not store the language preference on the account', error);
    return false;
  }
}
/**
 * Fetch users with filters (Admin only)
 */
export const fetchUsers = async (
  role: string,
  isDeleted: boolean,
  search: string,
  page: number,
  pageSize: number,
): Promise<ApiResponse<PagedResult<UserDto>>> => {
  const params = new URLSearchParams({
    Role: role,
    IsDeleted: String(isDeleted),
    Search: search,
    Page: String(page),
    PageSize: String(pageSize),
  });

  return await apiClient.get<ApiResponse<PagedResult<UserDto>>>(`${USER_API_URL}/users?${params.toString()}`);
};

/**
 * Register a new staff member (Admin only)
 */
export const registerStaff = async (command: RegisterStaffCommand): Promise<ApiResponse<any>> => {
  return await apiClient.post<ApiResponse<any>>(`${USER_API_URL}/register/staff`, command);
};

/**
 * Update staff member details (Admin only)
 */
export const updateStaff = async (command: UpdateStaffCommand): Promise<ApiResponse<any>> => {
  return await apiClient.post<ApiResponse<any>>(`${USER_API_URL}/update/staff`, command);
};

/**
 * Update customer profile (Admin only)
 */
export const updateCustomer = async (command: UpdateCustomerCommand): Promise<ApiResponse<UserDto>> => {
  return await apiClient.put<ApiResponse<UserDto>>(`${USER_API_URL}/profile`, command);
};

/**
 * Update user discount settings (Admin only)
 */
export const updateUserDiscounts = async (command: UpdateUserDiscountsCommand): Promise<ApiResponse<UserDto>> => {
  return await apiClient.put<ApiResponse<UserDto>>(`${USER_API_URL}/user-discounts`, command);
};

/**
 * Delete/Soft delete a user (Admin only)
 */
export const deleteUser = async (userId: string, permanent: boolean = false): Promise<ApiResponse<string>> => {
  return await apiClient.delete<ApiResponse<string>>(`${USER_API_URL}/delete/user`, {
    body: JSON.stringify({ userId, permanent }),
  });
};

/**
 * Reactivate a soft-deleted user (Admin only)
 */
export const reactivateUser = async (userId: string): Promise<ApiResponse<string>> => {
  return await apiClient.post<ApiResponse<string>>(`${USER_API_URL}/reactivate/${userId}`, {});
};

/**
 * Legacy method - kept for backward compatibility
 */
export const deleteStaff = async (userId: string, permanent: boolean = false): Promise<ApiResponse<string>> => {
  return deleteUser(userId, permanent);
};

/**
 * Get user statistics (Admin only)
 */
export const getUserStatistics = async (): Promise<ApiResponse<UserStatistics>> => {
  return await apiClient.get<ApiResponse<UserStatistics>>(`${USER_API_URL}/statistics`);
};
