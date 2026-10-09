import type { TFunction } from 'i18next';
import { ApiError } from '@/utils/apiClient';
import { serverTaskActionError, serverTaskReasonCopy } from './serverTaskErrorMessages';

const translate = ((key: string, fallback?: string) => fallback ?? key) as unknown as TFunction;

describe('server task kitchen blockers', () => {
  it.each([
    ['KitchenWorkUnresolved', 'Acknowledge the kitchen work before handover.'],
    ['KitchenCorrectionUnresolved', 'Acknowledge the kitchen correction before handover.'],
  ])('provides the operator remedy for %s', (reasonCode, expectedMessage) => {
    expect(serverTaskReasonCopy(reasonCode, translate)).toBe(expectedMessage);
    expect(serverTaskActionError(new ApiError(409, 'Conflict', undefined, reasonCode), translate)).toBe(
      expectedMessage,
    );
  });

  it('keeps unknown refusals on the safe generic remedy', () => {
    expect(serverTaskReasonCopy('FutureBlocker', translate)).toBe('Delivery is not permitted for this task.');
  });
});
