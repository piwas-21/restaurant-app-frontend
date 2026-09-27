import type { LanguageCode } from '@/config/languageConfig';
import type { ApiResponse } from '@/types/order';
import type { TranslationProvenance } from '@/types/translationMetadata';
import { throwServerRefusal } from '@/utils/apiFormErrors';
import { apiClient } from '@/utils/apiClient';

export type TranslationEntityType = 'product' | 'productIngredient' | 'productVariation' | 'menuSection' | 'optionSet';
export type TranslationFieldKey = 'name' | 'description';
export type TranslationGenerationIntent = 'saveReview' | 'explicitFill';
export type TranslationTargetStatusCode = 'missing' | 'current' | 'stale' | 'sourceCopy';
export type { TranslationSourceKind } from '@/types/translationMetadata';

export interface TranslationFieldRef {
  readonly entityType: TranslationEntityType;
  readonly entityId?: string;
  readonly clientKey?: string;
  readonly fieldKey: TranslationFieldKey;
}

export interface TranslationFieldInput {
  readonly fieldRef: TranslationFieldRef;
  readonly sourceLocale: LanguageCode;
  readonly sourceText: string;
}

export interface TranslationTargetStatus {
  readonly locale: LanguageCode;
  readonly status: TranslationTargetStatusCode;
  readonly text?: string | null;
  readonly provenance?: TranslationProvenance | null;
}

export interface TranslationFieldStatus {
  readonly fieldRef: TranslationFieldRef;
  readonly sourceLocale: LanguageCode;
  readonly sourceHash: string;
  readonly sourceText: string;
  readonly targets: readonly TranslationTargetStatus[];
}

export interface TranslationWorkbenchRequest {
  readonly generationIntent: TranslationGenerationIntent;
  readonly targetLocales: readonly LanguageCode[];
  readonly fields: readonly TranslationFieldInput[];
}

export interface TranslationPreviewResponse {
  readonly rows: TranslationFieldStatus[];
}

export interface TranslationSuggestion {
  readonly suggestionId: string;
  readonly fieldRef: TranslationFieldRef;
  readonly locale: LanguageCode;
  readonly sourceHash: string;
  readonly text: string;
  readonly provider: string;
  readonly model: string;
  readonly status: 'suggested';
}

export interface TranslationGap {
  readonly fieldRef: TranslationFieldRef;
  readonly locale: LanguageCode;
  readonly reason: string;
}

export interface TranslationSuggestionsResponse {
  readonly suggestions: TranslationSuggestion[];
  readonly skipped: TranslationGap[];
  readonly providerStatus: 'disabled' | 'ready';
}

export type TranslationDecision = {
  readonly suggestionId: string;
  readonly decision: 'accept' | 'reject' | 'edit';
  readonly text?: string;
};

export interface TranslationDecisionResult {
  readonly suggestionId: string;
  readonly decision: TranslationDecision['decision'];
  readonly status: 'accepted' | 'edited' | 'rejected' | 'stale' | 'notFound';
  readonly text?: string;
}

export interface TranslationReviewResponse {
  readonly decisions: TranslationDecisionResult[];
}

export interface TranslationWorkbenchAdapter {
  preview(request: TranslationWorkbenchRequest): Promise<TranslationPreviewResponse>;
  suggest(request: TranslationWorkbenchRequest): Promise<TranslationSuggestionsResponse>;
  review(decisions: readonly TranslationDecision[]): Promise<TranslationReviewResponse>;
}

async function postData<T>(path: string, body: unknown): Promise<T> {
  const response = await apiClient.post<ApiResponse<T>>(path, body, { requireAuth: true });
  if (response.success !== true || response.data === undefined || response.data === null) {
    throwServerRefusal(response);
  }
  return response.data;
}

/** Admin-only workbench routes; accepted copy is applied by the ordinary editor Save. */
export const translationWorkbenchService: TranslationWorkbenchAdapter = {
  preview: (request) => postData('/api/translation-workbench/preview', request),
  suggest: (request) => postData('/api/translation-workbench/suggestions', request),
  review: (decisions) => postData('/api/translation-workbench/review', { decisions }),
};
