import type { ConfirmationFlowConfig } from '@/hooks/orderTypes/useConfirmationFlowConfig';

export function shouldQueuePendingReview(
  orderType: string,
  flowsLoading: boolean,
  flowByType: Map<string, ConfirmationFlowConfig> | null,
): boolean {
  return flowsLoading || flowByType?.get(orderType)?.flow === 'acknowledge';
}
