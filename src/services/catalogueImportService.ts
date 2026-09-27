import type { CatalogueTemplateType } from './catalogueTemplateService';
import { apiClient } from '@/utils/apiClient';

export type CatalogueImportStatus = 'Draft' | 'Importing' | 'Imported' | 'PartiallyImported' | 'Failed';
export type CatalogueImportItemStatus = 'Pending' | 'Imported' | 'Failed' | 'Skipped';
export type CatalogueImportResolution = 'Create' | 'Reuse';
export type CatalogueLocalProductType = 'MainItem' | 'Beverage' | 'Dessert' | 'Sauce' | 'AddOn';

export const importStatusLabelKey = (status: CatalogueImportStatus): string => {
  switch (status) {
    case 'Draft':
      return 'catalogue_import_status_draft';
    case 'Importing':
      return 'catalogue_import_status_importing';
    case 'Imported':
      return 'catalogue_import_status_imported';
    case 'PartiallyImported':
      return 'catalogue_import_status_partially_imported';
    case 'Failed':
      return 'catalogue_import_status_failed';
  }
};

export const importItemStatusLabelKey = (status: CatalogueImportItemStatus): string => {
  switch (status) {
    case 'Pending':
      return 'catalogue_import_item_pending';
    case 'Imported':
      return 'catalogue_import_status_imported';
    case 'Failed':
      return 'catalogue_import_status_failed';
    case 'Skipped':
      return 'catalogue_import_item_skipped';
  }
};

export interface CataloguePreferences {
  readonly cuisines: string[];
}

export interface CatalogueImportDecision {
  readonly templateId: string;
  readonly revision: number;
  readonly resolution: CatalogueImportResolution;
  readonly localEntityId?: string;
  readonly localName?: string;
  readonly localDescription?: string;
  readonly localPrice?: number;
  readonly localProductType?: CatalogueLocalProductType;
  readonly intendedIsAvailable?: boolean;
  readonly localOptionPrices?: Readonly<Record<string, number>>;
  readonly ingredients?: readonly string[];
  readonly allergens?: readonly string[];
  readonly ingredientsReviewed?: boolean;
  readonly allergensReviewed?: boolean;
  readonly availabilityReviewed?: boolean;
  readonly channelsReviewed?: boolean;
  readonly kitchenRoutingReviewed?: boolean;
  readonly optionPricesReviewed?: boolean;
  readonly choiceRulesReviewed?: boolean;
  readonly rejectedCandidateIds?: readonly string[];
  readonly availableOrderTypes?: readonly ('DineIn' | 'Takeaway' | 'Delivery')[] | null;
  readonly kitchenType?: 'None' | 'FrontKitchen' | 'BackKitchen';
}

export interface CatalogueImportSessionStart {
  readonly sessionId: string;
  readonly version: number;
}

export interface CatalogueImportSessionItem {
  readonly templateId: string;
  readonly revision: number;
  readonly type: CatalogueTemplateType;
  readonly displayName: string;
  readonly description: string | null;
  readonly contentHash: string;
  readonly isRoot: boolean;
  readonly isSelectable: boolean;
  readonly isSelected: boolean;
  readonly selectionRole: string;
  readonly status: CatalogueImportItemStatus;
  readonly localEntityType: string | null;
  readonly localEntityId: string | null;
  readonly failureCode: string | null;
  readonly decision: CatalogueImportDecision | null;
}

export interface CatalogueImportSession {
  readonly sessionId: string;
  readonly rootTemplateId: string;
  readonly rootRevision: number;
  readonly locale: string;
  readonly version: number;
  readonly status: CatalogueImportStatus;
  readonly createNewCopy: boolean;
  readonly items: CatalogueImportSessionItem[];
}

export interface CatalogueImportCandidate {
  readonly entityType: string;
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly categoryName?: string;
}

export interface CatalogueImportIssue {
  readonly code: string;
  readonly message: string;
}

export interface CatalogueImportPreviewItem {
  readonly templateId: string;
  readonly revision: number;
  readonly type: CatalogueTemplateType;
  readonly displayName: string;
  readonly isSelected: boolean;
  readonly resolution: CatalogueImportResolution;
  readonly localEntityId: string | null;
  readonly candidates: CatalogueImportCandidate[];
  readonly warnings: CatalogueImportIssue[];
  readonly blockingIssues: CatalogueImportIssue[];
}

export interface CatalogueImportPreview {
  readonly sessionId: string;
  readonly version: number;
  readonly items: CatalogueImportPreviewItem[];
}

export interface CatalogueImportResult {
  readonly sessionId: string;
  readonly version: number;
  readonly status: CatalogueImportStatus;
  readonly items: Array<{
    templateId: string;
    revision: number;
    status: CatalogueImportItemStatus;
    localEntityType: string | null;
    localEntityId: string | null;
    failureCode: string | null;
  }>;
}

export interface CatalogueRevisionChanges {
  readonly sessionId: string;
  readonly items: Array<{
    templateId: string;
    adoptedRevision: number;
    adoptedContentHash: string;
    currentRevision?: number;
    currentContentHash?: string;
    withdrawn: boolean;
    fields: Array<{ path: string; baseline: unknown; current: unknown; localValue: unknown; localChanged: boolean }>;
    notice: string;
  }>;
}

const sessionPath = (sessionId: string) => `/api/catalogue/import-sessions/${encodeURIComponent(sessionId)}`;

export const getCataloguePreferences = (): Promise<CataloguePreferences> =>
  apiClient.get('/api/catalogue/preferences', { requireAuth: true });

export const putCataloguePreferences = (cuisines: readonly string[]): Promise<CataloguePreferences> =>
  apiClient.put('/api/catalogue/preferences', { cuisines }, { requireAuth: true });

export const startCatalogueImportSession = (body: {
  templateId: string;
  revision: number;
  locale: string;
  idempotencyKey: string;
  selectedTemplateIds?: readonly string[];
  createNewCopy?: boolean;
}): Promise<{ sessionId: string; version: number }> =>
  apiClient.post('/api/catalogue/import-sessions', body, { requireAuth: true });

export const getCatalogueImportSession = (sessionId: string): Promise<CatalogueImportSession> =>
  apiClient.get(sessionPath(sessionId), { requireAuth: true });

export const updateCatalogueImportItems = (
  sessionId: string,
  body: {
    expectedVersion: number;
    selectedTemplateIds: readonly string[];
    decisions: readonly CatalogueImportDecision[];
  },
): Promise<void> => apiClient.put(`${sessionPath(sessionId)}/items`, body, { requireAuth: true });

export const previewCatalogueImport = (sessionId: string): Promise<CatalogueImportPreview> =>
  apiClient.post(`${sessionPath(sessionId)}/preview`, {}, { requireAuth: true });

export const importCatalogueSession = (
  sessionId: string,
  body: { expectedVersion: number; idempotencyKey: string },
): Promise<CatalogueImportResult> => apiClient.post(`${sessionPath(sessionId)}/import`, body, { requireAuth: true });

export const getCatalogueRevisionChanges = (sessionId: string): Promise<CatalogueRevisionChanges> =>
  apiClient.get(`${sessionPath(sessionId)}/revision-changes`, { requireAuth: true });
