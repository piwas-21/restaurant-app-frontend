import { z } from 'zod';

const routingStateSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  revision: z.number(),
  target: z.string(),
  status: z.string(),
  deviceId: z.string().nullish(),
  failureReason: z.string().nullish(),
  lastAcknowledgedAt: z.string().nullish(),
  version: z.number(),
  isRequired: z.boolean(),
});

const taskActionSchema = z.object({
  action: z.string(),
  allowed: z.boolean(),
  reasonCode: z.string().nullish(),
  targetStatus: z.string().nullish(),
});

export const serverServiceTaskSchema = z.object({
  orderId: z.string(),
  orderNumber: z.string(),
  orderType: z.string(),
  status: z.string(),
  bucket: z.enum(['Ready', 'Overdue', 'Exception']),
  actionableAt: z.string(),
  ageSeconds: z.number(),
  tableId: z.string().nullish(),
  tableLabel: z.string().nullish(),
  tableNumber: z.number().nullish(),
  serviceSessionId: z.string().nullish(),
  total: z.number(),
  remainingAmount: z.number(),
  version: z.number(),
  routingState: z.string(),
  hasRequiredRoutingException: z.boolean(),
  hasOptionalRoutingException: z.boolean(),
  routing: z.array(routingStateSchema),
  permittedDeliveryActions: z.array(taskActionSchema),
});

export const serverTaskFeedSchema = z.object({
  serverTime: z.string(),
  items: z.array(serverServiceTaskSchema),
  totalCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullish(),
  hasMore: z.boolean(),
  removedOrderIds: z.array(z.string()),
});

export type ServerTaskFeedPayload = z.infer<typeof serverTaskFeedSchema>;
