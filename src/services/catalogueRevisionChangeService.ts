import { apiClient } from '@/utils/apiClient';

export interface CatalogueRevisionChangeField {
  readonly path: string;
  readonly baseline: unknown;
  readonly current: unknown;
  readonly localValue: unknown;
  readonly localChanged: boolean;
}

export interface CatalogueRevisionChangeItem {
  readonly templateId: string;
  readonly adoptedRevision: number;
  readonly adoptedContentHash: string;
  readonly localHash: string;
  readonly currentRevision?: number | null;
  readonly currentContentHash?: string | null;
  readonly withdrawn: boolean;
  readonly adoptedRevisionWithdrawn: boolean;
  readonly status: string;
  readonly fieldDiffs: CatalogueRevisionChangeField[];
  readonly notice: string;
}

export interface CatalogueRevisionChanges {
  readonly sessionId: string;
  readonly sessionVersion: number;
  readonly items: CatalogueRevisionChangeItem[];
}

export interface CatalogueRevisionChangeApplyResult {
  readonly sessionId: string;
  readonly sessionVersion: number;
  readonly templateId: string;
  readonly adoptedRevision: number;
  readonly contentHash: string;
  readonly appliedFieldPaths: string[];
  readonly localHash: string;
}

const sessionPath = (sessionId: string) => `/api/catalogue/import-sessions/${encodeURIComponent(sessionId)}`;

export const getCatalogueRevisionChanges = (sessionId: string): Promise<CatalogueRevisionChanges> =>
  apiClient.get(`${sessionPath(sessionId)}/revision-changes`, { requireAuth: true });

export const applyCatalogueRevisionChanges = (
  sessionId: string,
  body: {
    expectedSessionVersion: number;
    templateId: string;
    adoptedRevision: number;
    currentRevision: number;
    currentContentHash: string;
    expectedLocalHash: string;
    fieldPaths: readonly string[];
  },
): Promise<CatalogueRevisionChangeApplyResult> =>
  apiClient.post(`${sessionPath(sessionId)}/revision-changes/apply`, body, { requireAuth: true });
