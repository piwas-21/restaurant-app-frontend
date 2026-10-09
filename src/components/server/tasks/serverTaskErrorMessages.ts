import type { TFunction } from 'i18next';
import { ApiError } from '@/utils/apiClient';

const REASON_COPY: Readonly<Record<string, readonly [string, string]>> = {
  RequiredRoutingUnresolved: ['server.tasks.reason_required_routing', 'Resolve required routing before delivery.'],
  KitchenWorkUnresolved: [
    'server.tasks.reason_kitchen_work_unresolved',
    'Acknowledge the kitchen work before handover.',
  ],
  KitchenCorrectionUnresolved: [
    'server.tasks.reason_kitchen_correction_unresolved',
    'Acknowledge the kitchen correction before handover.',
  ],
  KitchenReleaseRequired: ['server.tasks.reason_kitchen_release', 'Kitchen release is required.'],
  InvalidStatusTransition: ['server.tasks.reason_status', 'This order status cannot be delivered.'],
  DeliveryNotPermitted: ['server.tasks.reason_not_permitted', 'Delivery is not permitted for this task.'],
};

export function serverTaskReasonCopy(reasonCode: string | null | undefined, t: TFunction): string | null {
  if (!reasonCode) return null;
  const copy = REASON_COPY[reasonCode];
  return copy
    ? t(copy[0], copy[1])
    : t('server.tasks.reason_not_permitted', 'Delivery is not permitted for this task.');
}

export function serverTaskActionError(reason: unknown, t: TFunction): string {
  if (reason instanceof ApiError) {
    switch (reason.errorCode) {
      case 'OrderVersionConflict':
        return t('server.tasks.version_conflict', 'This order changed. The task list was refreshed.');
      case 'RequiredRoutingUnresolved':
      case 'KitchenWorkUnresolved':
      case 'KitchenCorrectionUnresolved':
        return (
          serverTaskReasonCopy(reason.errorCode, t) ??
          t('server.tasks.delivery_failed', 'The task could not be updated. Try again.')
        );
      default:
        break;
    }
  }
  return t('server.tasks.delivery_failed', 'The task could not be updated. Try again.');
}
