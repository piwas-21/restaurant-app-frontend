import { apiClient } from '@/utils/apiClient';
import { createOrderOperationalNote, getOrderOperationalNotes } from './orderOperationalNoteService';

jest.mock('@/utils/apiClient', () => ({
  ...jest.requireActual('@/utils/apiClient'),
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const note = {
  id: 'n1',
  orderId: 'o1',
  text: 'Allergy handover',
  audience: 'Kitchen' as const,
  createdAt: '2026-09-10T12:00:00Z',
  createdBy: 'Mina',
  clientOperationId: 'operation-1',
};

beforeEach(() => jest.clearAllMocks());

describe('orderOperationalNoteService', () => {
  it('loads the staff-only note collection from its separate endpoint', async () => {
    mockGet.mockResolvedValue({ success: true, data: [note] });

    await expect(getOrderOperationalNotes('o1')).resolves.toEqual([note]);
    expect(mockGet).toHaveBeenCalledWith('/api/orders/o1/notes', { requireAuth: true });
  });

  it('posts the audience and idempotency UUID without adding notes to OrderDto', async () => {
    const command = { text: 'Allergy handover', audience: 'Kitchen' as const, clientOperationId: 'operation-1' };
    mockPost.mockResolvedValue({ success: true, data: note });

    await expect(createOrderOperationalNote('o1', command)).resolves.toEqual(note);
    expect(mockPost).toHaveBeenCalledWith('/api/orders/o1/notes', command, { requireAuth: true });
  });

  it('keeps a server refusal readable when it arrives inside a successful transport envelope', async () => {
    mockPost.mockResolvedValue({ success: false, message: 'Operation failed', errors: ['Order is closed'] });

    await expect(
      createOrderOperationalNote('o1', { text: 'Late note', audience: 'Staff', clientOperationId: 'operation-2' }),
    ).rejects.toEqual(expect.objectContaining({ status: 200, errors: ['Order is closed'] }));
  });
});
