import { apiClient, ApiError } from '@/utils/apiClient';
import * as userService from './userService';
import { UserRole } from '@/types/user';

// Stub the HTTP surface, keep the error type and the predicate REAL. A bare
// `jest.mock('@/utils/apiClient')` automocks, which turns `isAuthError` into a `jest.fn()`
// returning `undefined` — `getCurrentUser`'s `if (!isAuthError(error))` guard is then always true
// inside this suite, so it would test the opposite of production and stay green.
jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchUsers', () => {
    it('should fetch users successfully', async () => {
      const mockResponse = { success: true, data: { items: [{ id: '1', firstName: 'John' }], totalCount: 1 } };
      mockApiClient.get.mockResolvedValue(mockResponse);

      const role = 'Customer';
      const isDeleted = false;
      const search = '';
      const page = 1;
      const pageSize = 10;

      const result = await userService.fetchUsers(role, isDeleted, search, page, pageSize);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/api/User/users?Role=Customer&IsDeleted=false&Search=&Page=1&PageSize=10`,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle error when fetching users', async () => {
      const mockErrorResponse = { success: false, message: 'Failed to fetch users' };
      mockApiClient.get.mockResolvedValue(mockErrorResponse);

      const result = await userService.fetchUsers('', false, '', 1, 10);

      expect(result).toEqual(mockErrorResponse);
    });
  });

  describe('registerStaff', () => {
    it('should register staff successfully', async () => {
      const mockResponse = { success: true, message: 'Staff registered successfully' };
      mockApiClient.post.mockResolvedValue(mockResponse);

      const staffData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: UserRole.Server,
      };
      const result = await userService.registerStaff(staffData);

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/User/register/staff', staffData);
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during staff registration', async () => {
      const mockErrorResponse = { success: false, message: 'Registration failed' };
      mockApiClient.post.mockResolvedValue(mockErrorResponse);

      const staffData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: UserRole.Server,
      };
      const result = await userService.registerStaff(staffData);

      expect(result).toEqual(mockErrorResponse);
    });
  });

  // `getCurrentUser` had no test at all, and it is one of the four sites whose log-suppression
  // guard changed with #401 — it used to ask whether the error MESSAGE contained 'auth', which
  // `apiClient` no longer writes. Note this call does NOT pass `requireAuth`, so its 401 comes
  // from the server rather than from a pre-flight refusal; the status is the same either way,
  // which is the point of gating on it.
  describe('getCurrentUser', () => {
    it('returns the profile', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { id: '1', firstName: 'Ada' } });

      await expect(userService.getCurrentUser()).resolves.toEqual({ id: '1', firstName: 'Ada' });
    });

    it('stays quiet for a 401, and logs anything else', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      try {
        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(401, ''));
        await expect(userService.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).not.toHaveBeenCalled();

        (apiClient.get as jest.Mock).mockRejectedValueOnce(new ApiError(500, ''));
        await expect(userService.getCurrentUser()).rejects.toBeInstanceOf(ApiError);
        expect(consoleError).toHaveBeenCalledTimes(1);
      } finally {
        consoleError.mockRestore();
      }
    });
  });

  describe('delete staff', () => {
    it('should delete user successfully', async () => {
      const mockResponse = { success: true, message: 'User deleted successfully' };
      mockApiClient.delete.mockResolvedValue(mockResponse);

      const userId = 'user123';
      const result = await userService.deleteStaff(userId);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/User/delete/user', {
        body: JSON.stringify({ userId, permanent: false }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should handle error during user deletion', async () => {
      const mockErrorResponse = { success: false, message: 'Deletion failed' };
      mockApiClient.delete.mockResolvedValue(mockErrorResponse);

      const userId = 'user123';
      const result = await userService.deleteStaff(userId);

      expect(result).toEqual(mockErrorResponse);
    });
  });
});
