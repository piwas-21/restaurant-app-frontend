import type { OrderAmendmentItemDto, OrderAmendmentLineChangeRequest } from '@/types/orderAmendment';

export type OrderAmendmentPhase = 'editing' | 'quoting' | 'review' | 'committing' | 'uncertain' | 'committed';

export interface OrderAmendmentDraft {
  readonly additions: OrderAmendmentItemDto[];
  readonly changes: OrderAmendmentLineChangeRequest[];
  readonly reason: string;
  readonly preparingOverrideAcknowledged: boolean;
  readonly releaseAdditionsToKitchen: boolean;
  readonly localProviderSupplementConsent: boolean;
  readonly providerConsentNote: string;
}
