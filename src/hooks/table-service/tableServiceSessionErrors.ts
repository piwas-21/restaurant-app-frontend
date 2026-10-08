import { ApiError, getErrorMessage } from '@/utils/apiClient';

export function tableServiceCloseErrorMessage(reason: unknown): string {
  if (reason instanceof ApiError) {
    switch (reason.errorCode) {
      case 'KitchenCorrectionUnresolved':
        return 'server.bill.close_blocked_kitchen_correction';
      case 'KitchenWorkUnresolved':
        return 'server.bill.close_blocked_kitchen_work';
      default:
        break;
    }
  }
  return getErrorMessage(reason) ?? 'cashier.tables.close_failed';
}
