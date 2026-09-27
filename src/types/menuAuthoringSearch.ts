import type { OptionSetKind } from './optionSet';

export type MenuAuthoringCandidateType = 'product' | 'component' | 'bundle' | 'ingredient' | 'optionSet';
export type MenuAuthoringMatchSource = 'name' | 'alias';

export interface MenuAuthoringCandidate {
  readonly id: string;
  readonly type: MenuAuthoringCandidateType;
  readonly name: string;
  readonly matchSource: MenuAuthoringMatchSource;
  readonly categoryName?: string | null;
  readonly imageUrl?: string | null;
  readonly basePrice?: number | null;
  readonly productType?: string | null;
  readonly ingredientKind?: string | null;
  readonly isComponent: boolean;
  readonly isActive: boolean;
  readonly isAvailable: boolean;
  readonly version?: number | null;
  readonly entryCount?: number | null;
  readonly attachmentCount?: number | null;
}

export interface MenuAuthoringSearchPage {
  readonly items: MenuAuthoringCandidate[];
  readonly nextCursor?: string | null;
}

export interface MenuAuthoringSearchFilters {
  readonly query: string;
  readonly forKind?: OptionSetKind;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface MenuAuthoringApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly message?: string;
  readonly errors?: string[];
  readonly errorCode?: string;
}

export interface MenuAuthoringMatchDecisionRequest {
  readonly query: string;
  readonly candidateType: MenuAuthoringCandidateType;
  readonly candidateId: string;
  readonly decision: 'accept' | 'reject';
  readonly alias?: string;
}
