import { z } from 'zod';
import { apiClient } from '@/utils/apiClient';
import type { ChannelDecisionDto, ChannelDecisionRequest } from '@/types/order/channelDecision';

const decisionSchema = z.object({
  operationId: z.string().uuid(),
  orderId: z.string().uuid(),
  action: z.enum(['accept', 'deny']),
  state: z.enum(['Pending', 'Leased', 'Unknown', 'Succeeded', 'Failed']),
  createdAt: z.string().datetime({ offset: true }),
  lastObservedAt: z.string().datetime({ offset: true }).nullable(),
});
const endpoint = (orderId: string) => `/api/delivery-channels/orders/${encodeURIComponent(orderId)}/decision`;

function readDecision(value: unknown, orderId: string): ChannelDecisionDto {
  const result = decisionSchema.parse(value);
  if (result.orderId !== orderId) throw new Error('Unexpected decision identity');
  return result;
}

export async function getChannelDecision(orderId: string): Promise<ChannelDecisionDto | null> {
  const result = await apiClient.get<unknown>(endpoint(orderId), { requireAuth: true });
  // ASP.NET serializes a null action result as 204; apiClient represents an empty body as {}.
  if (
    result === null ||
    (typeof result === 'object' &&
      result !== null &&
      !Array.isArray(result) &&
      Object.getPrototypeOf(result) === Object.prototype &&
      Object.keys(result).length === 0)
  )
    return null;
  return readDecision(result, orderId);
}

export async function queueChannelDecision(
  orderId: string,
  request: ChannelDecisionRequest,
): Promise<ChannelDecisionDto> {
  const result = readDecision(
    await apiClient.post<unknown>(endpoint(orderId), request, { requireAuth: true }),
    orderId,
  );
  if (result.operationId !== request.operationId || result.action !== request.action)
    throw new Error('Unexpected decision operation');
  return result;
}
