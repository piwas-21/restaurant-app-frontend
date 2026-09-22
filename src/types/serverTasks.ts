import type { ApiResponse } from '@/types/order/common';

export type ServerTaskBucket = 'ready' | 'overdue' | 'exception';
export type ServerTaskBucketLabel = 'Ready' | 'Overdue' | 'Exception';

export interface ServerTaskAction {
  action: string;
  allowed: boolean;
  reasonCode?: string | null;
  targetStatus?: string | null;
}

export interface ServerTaskRoutingState {
  id: string;
  jobId: string;
  revision: number;
  target: string;
  status: string;
  deviceId?: string | null;
  failureReason?: string | null;
  lastAcknowledgedAt?: string | null;
  version: number;
  isRequired: boolean;
}

/** Additive mirror of backend ServerServiceTaskDto (backend PR #566). */
export interface ServerServiceTask {
  orderId: string;
  orderNumber: string;
  orderType: string;
  status: string;
  bucket: ServerTaskBucketLabel;
  actionableAt: string;
  ageSeconds: number;
  tableId?: string | null;
  tableLabel?: string | null;
  tableNumber?: number | null;
  serviceSessionId?: string | null;
  total: number;
  remainingAmount: number;
  version: number;
  routingState: string;
  hasRequiredRoutingException: boolean;
  hasOptionalRoutingException: boolean;
  routing: ServerTaskRoutingState[];
  permittedDeliveryActions: ServerTaskAction[];
}

export interface ServerTaskFeed {
  serverTime: string;
  items: ServerServiceTask[];
  totalCount: number;
  nextCursor?: string | null;
  hasMore: boolean;
  removedOrderIds: string[];
}

export type ServerTaskFeedApiResponse = ApiResponse<ServerTaskFeed>;

export interface DeliverServerTaskRequest {
  expectedVersion: number;
}
