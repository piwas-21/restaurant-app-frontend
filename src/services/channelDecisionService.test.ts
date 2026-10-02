import { apiClient } from '@/utils/apiClient';
import { getChannelDecision, queueChannelDecision } from './channelDecisionService';

jest.mock('@/utils/apiClient');
const id = '11111111-1111-4111-8111-111111111111';
const operationId = '22222222-2222-4222-8222-222222222222';
const dto = {
  orderId: id,
  operationId,
  action: 'accept',
  state: 'Pending',
  createdAt: '2026-10-01T20:00:00Z',
  lastObservedAt: null,
};
beforeEach(() => jest.clearAllMocks());

it.each([null, {}])('reads the nullable no-decision response %p', async (body) => {
  jest.mocked(apiClient.get).mockResolvedValue(body);
  await expect(getChannelDecision(id)).resolves.toBeNull();
  expect(apiClient.get).toHaveBeenCalledWith(`/api/delivery-channels/orders/${id}/decision`, { requireAuth: true });
});
it.each([
  { success: false },
  { ...dto, orderId: operationId },
  { ...dto, state: 'Confirmed' },
  { ...dto, createdAt: 'yesterday' },
])('refuses invalid decision evidence %p', async (body) => {
  jest.mocked(apiClient.get).mockResolvedValue(body);
  await expect(getChannelDecision(id)).rejects.toThrow();
});
it('posts the stable operation/version contract and reads a plain DTO', async () => {
  jest.mocked(apiClient.post).mockResolvedValue(dto);
  const request = { operationId, action: 'accept' as const, reason: 'Items checked', expectedVersion: 7 };
  await expect(queueChannelDecision(id, request)).resolves.toEqual(dto);
  expect(apiClient.post).toHaveBeenCalledWith(`/api/delivery-channels/orders/${id}/decision`, request, {
    requireAuth: true,
  });
});
it.each([
  { ...dto, operationId: id },
  { ...dto, action: 'deny' },
])('refuses a success response for a different operation %p', async (body) => {
  jest.mocked(apiClient.post).mockResolvedValue(body);
  await expect(
    queueChannelDecision(id, { operationId, action: 'accept', reason: 'Checked', expectedVersion: 1 }),
  ).rejects.toThrow();
});

it('refuses an empty array as missing decision evidence', async () => {
  jest.mocked(apiClient.get).mockResolvedValue([]);
  await expect(getChannelDecision(id)).rejects.toThrow();
});
