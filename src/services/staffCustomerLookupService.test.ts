import { apiClient } from '@/utils/apiClient';
import { lookupStaffCustomers } from './staffCustomerLookupService';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('lookupStaffCustomers', () => {
  it('does not call the API until the search has two characters', async () => {
    await expect(lookupStaffCustomers(' A ')).resolves.toEqual([]);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('uses the scoped customer lookup endpoint and page size', async () => {
    const customer = {
      id: 'user-7',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      email: 'ada@example.test',
      phoneNumber: '+41220000000',
      currentPoints: 120,
    };
    mockGet.mockResolvedValue({ success: true, data: [customer] });
    await expect(lookupStaffCustomers('  Ada  ')).resolves.toEqual([customer]);
    expect(mockGet).toHaveBeenCalledWith('/api/User/customer-lookup?search=Ada&pageSize=10', {
      requireAuth: true,
    });
  });

  it('does not turn a failed response envelope into an empty successful result', async () => {
    mockGet.mockResolvedValue({ success: false, message: 'Lookup refused', errors: ['Lookup refused'] });

    await expect(lookupStaffCustomers('Ada')).rejects.toThrow('Lookup refused');
  });
});
