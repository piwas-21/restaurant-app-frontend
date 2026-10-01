/** Mirrors ChannelDecisionRequest / ChannelDecisionDto in the tenant delivery-channel API. */
export type ChannelDecisionAction = 'accept' | 'deny';
export type ChannelDecisionState = 'Pending' | 'Leased' | 'Unknown' | 'Succeeded' | 'Failed';

export interface ChannelDecisionRequest {
  operationId: string;
  action: ChannelDecisionAction;
  reason: string;
  expectedVersion: number;
}

export interface ChannelDecisionDto {
  operationId: string;
  orderId: string;
  action: ChannelDecisionAction;
  state: ChannelDecisionState;
  createdAt: string;
  lastObservedAt: string | null;
}
