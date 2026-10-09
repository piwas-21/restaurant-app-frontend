import type {
  AmendmentResolutionQuote,
  AmendmentResolutionQuoteRequest,
  AmendmentResolutionRefusal,
  AmendmentResolutionResult,
} from '@/types/amendmentResolution';

export type AmendmentResolutionStage =
  | 'checking'
  | 'idle'
  | 'quoting'
  | 'review'
  | 'reviewFailed'
  | 'pending'
  | 'working'
  | 'resolved'
  | 'refused'
  | 'unavailable';

export interface AmendmentResolutionState {
  readonly stage: AmendmentResolutionStage;
  readonly quote?: AmendmentResolutionQuote;
  readonly request?: AmendmentResolutionQuoteRequest;
  readonly result?: AmendmentResolutionResult;
  readonly refusal?: AmendmentResolutionRefusal;
}
