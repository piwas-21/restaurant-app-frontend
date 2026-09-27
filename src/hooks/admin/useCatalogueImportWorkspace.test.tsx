import { act, renderHook, waitFor } from '@testing-library/react';
import {
  getCatalogueImportSession,
  getCatalogueRevisionChanges,
  importCatalogueSession,
  previewCatalogueImport,
  startCatalogueImportSession,
  updateCatalogueImportItems,
  type CatalogueImportPreview,
  type CatalogueImportSession,
} from '@/services/catalogueImportService';
import { useCatalogueImportWorkspace } from './useCatalogueImportWorkspace';

jest.mock('@/services/catalogueImportService', () => ({
  getCatalogueImportSession: jest.fn(),
  getCatalogueRevisionChanges: jest.fn(),
  importCatalogueSession: jest.fn(),
  previewCatalogueImport: jest.fn(),
  startCatalogueImportSession: jest.fn(),
  updateCatalogueImportItems: jest.fn(),
}));

const session: CatalogueImportSession = {
  sessionId: 'session-1',
  rootTemplateId: 'pack',
  rootRevision: 1,
  locale: 'en',
  version: 1,
  status: 'Draft',
  createNewCopy: false,
  items: [
    {
      templateId: 'pack',
      revision: 1,
      type: 'cuisine-pack',
      displayName: 'Pack',
      description: null,
      contentHash: 'pack-hash',
      isRoot: true,
      isSelectable: false,
      isSelected: true,
      selectionRole: 'root',
      status: 'Pending',
      localEntityType: null,
      localEntityId: null,
      failureCode: null,
      decision: null,
    },
    {
      templateId: 'offer',
      revision: 2,
      type: 'item',
      displayName: 'Offer',
      description: null,
      contentHash: 'offer-hash',
      isRoot: false,
      isSelectable: true,
      isSelected: true,
      selectionRole: 'offer',
      status: 'Pending',
      localEntityType: null,
      localEntityId: null,
      failureCode: null,
      decision: null,
    },
  ],
};

const preview: CatalogueImportPreview = {
  sessionId: 'session-1',
  version: 2,
  items: [
    {
      templateId: 'pack',
      revision: 1,
      type: 'cuisine-pack',
      displayName: 'Pack',
      isSelected: true,
      resolution: 'Create',
      localEntityId: null,
      candidates: [],
      warnings: [],
      blockingIssues: [],
    },
    {
      templateId: 'offer',
      revision: 2,
      type: 'item',
      displayName: 'Offer',
      isSelected: false,
      resolution: 'Create',
      localEntityId: null,
      candidates: [],
      warnings: [],
      blockingIssues: [],
    },
  ],
};

const options = {
  templateId: 'pack',
  revision: 1,
  locale: 'en',
  selectedTemplateIds: ['offer'],
  createNewCopy: false,
  onSessionCreated: jest.fn(),
};

describe('useCatalogueImportWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    (startCatalogueImportSession as jest.Mock).mockResolvedValue({ sessionId: 'session-1', version: 1 });
    (getCatalogueImportSession as jest.Mock).mockImplementation(async () => session);
    (updateCatalogueImportItems as jest.Mock).mockResolvedValue(undefined);
    (previewCatalogueImport as jest.Mock).mockResolvedValue(preview);
    (importCatalogueSession as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      version: 3,
      status: 'Imported',
      items: [],
    });
    (getCatalogueRevisionChanges as jest.Mock).mockResolvedValue(null);
  });

  it('pins the requested revision, persists offer exclusions and checks blockers before import', async () => {
    (previewCatalogueImport as jest.Mock).mockResolvedValue({
      ...preview,
      items: [
        { ...preview.items[0], blockingIssues: [{ code: 'TENANT_PRICE_REQUIRED', message: 'Set a local price.' }] },
        preview.items[1],
      ],
    });
    const { result } = renderHook(() => useCatalogueImportWorkspace(options));
    await waitFor(() => expect(result.current.session?.sessionId).toBe('session-1'));
    expect(startCatalogueImportSession).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'pack',
        revision: 1,
        locale: 'en',
        selectedTemplateIds: ['offer'],
        createNewCopy: false,
        idempotencyKey: expect.any(String),
      }),
    );

    act(() => result.current.toggleSelection('offer', false));
    await act(async () => result.current.checkPreview());
    expect(updateCatalogueImportItems).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        expectedVersion: 1,
        selectedTemplateIds: ['pack'],
      }),
    );

    await act(async () => result.current.runImport());
    expect(importCatalogueSession).not.toHaveBeenCalled();
    expect(result.current.preview?.items[0].blockingIssues[0].code).toBe('TENANT_PRICE_REQUIRED');
  });

  it('uses the saved session version and a stable idempotency key for import retries', async () => {
    (getCatalogueImportSession as jest.Mock).mockImplementation(async () => ({ ...session, version: 2 }));
    const { result } = renderHook(() => useCatalogueImportWorkspace(options));
    await waitFor(() => expect(result.current.session?.sessionId).toBe('session-1'));
    await act(async () => result.current.runImport());
    await act(async () => result.current.runImport());

    const calls = (importCatalogueSession as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][1].expectedVersion).toBe(2);
    expect(calls[0][1].idempotencyKey).toBe(calls[1][1].idempotencyKey);
    expect(result.current.result?.status).toBe('Imported');
  });
});
