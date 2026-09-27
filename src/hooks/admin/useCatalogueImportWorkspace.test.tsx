import { act, renderHook, waitFor } from '@testing-library/react';
import {
  getCatalogueImportSession,
  importCatalogueSession,
  previewCatalogueImport,
  startCatalogueImportSession,
  updateCatalogueImportItems,
  type CatalogueImportPreview,
  type CatalogueImportSession,
} from '@/services/catalogueImportService';
import { applyCatalogueRevisionChanges, getCatalogueRevisionChanges } from '@/services/catalogueRevisionChangeService';
import { useCatalogueImportWorkspace } from './useCatalogueImportWorkspace';

jest.mock('@/services/catalogueImportService', () => ({
  getCatalogueImportSession: jest.fn(),
  importCatalogueSession: jest.fn(),
  previewCatalogueImport: jest.fn(),
  startCatalogueImportSession: jest.fn(),
  updateCatalogueImportItems: jest.fn(),
}));

jest.mock('@/services/catalogueRevisionChangeService', () => ({
  applyCatalogueRevisionChanges: jest.fn(),
  getCatalogueRevisionChanges: jest.fn(),
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
    (getCatalogueRevisionChanges as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      sessionVersion: 1,
      items: [],
    });
    (applyCatalogueRevisionChanges as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => jest.useRealTimers());

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

  it('does not call the import endpoint for a completed session', async () => {
    const completed: CatalogueImportSession = { ...session, status: 'Imported' };
    (getCatalogueImportSession as jest.Mock).mockResolvedValue(completed);
    const { result } = renderHook(() => useCatalogueImportWorkspace({ ...options, sessionId: 'session-1' }));
    await waitFor(() => expect(result.current.session?.status).toBe('Imported'));

    await act(async () => result.current.runImport());
    expect(importCatalogueSession).not.toHaveBeenCalled();
    expect(updateCatalogueImportItems).not.toHaveBeenCalled();
  });

  it('defaults an existing mapping to Reuse and only edits failed decisions after import starts', async () => {
    const partialSession: CatalogueImportSession = {
      ...session,
      version: 7,
      status: 'PartiallyImported',
      items: [
        { ...session.items[0], status: 'Imported', isSelectable: false },
        { ...session.items[1], status: 'Failed', localEntityId: 'local-offer', decision: null },
      ],
    };
    (getCatalogueImportSession as jest.Mock).mockResolvedValue(partialSession);
    const { result } = renderHook(() => useCatalogueImportWorkspace({ ...options, sessionId: 'session-1' }));
    await waitFor(() => expect(result.current.session?.status).toBe('PartiallyImported'));

    expect(result.current.decisions['offer@2']).toEqual({
      templateId: 'offer',
      revision: 2,
      resolution: 'Reuse',
      localEntityId: 'local-offer',
    });
    expect(result.current.canEditSelection).toBe(false);
    expect(result.current.canEditDecision(partialSession.items[0])).toBe(false);
    expect(result.current.canEditDecision(partialSession.items[1])).toBe(true);

    act(() => {
      result.current.toggleSelection('offer', false);
      result.current.updateDecision('pack@1', { localName: 'Must stay locked' });
      result.current.updateDecision('offer@2', { localName: 'Reviewed retry' });
    });
    expect(result.current.selectedIds).toEqual(['pack', 'offer']);
    expect(result.current.decisions['pack@1'].localName).toBeUndefined();
    expect(result.current.decisions['offer@2'].localName).toBe('Reviewed retry');

    await act(async () => result.current.checkPreview());
    expect(updateCatalogueImportItems).toHaveBeenCalledWith('session-1', {
      expectedVersion: 7,
      selectedTemplateIds: ['pack', 'offer'],
      decisions: [{ templateId: 'offer', revision: 2, resolution: 'Reuse', localEntityId: 'local-offer' }],
    });
  });

  it('applies explicitly selected revision fields with current version and hashes', async () => {
    const changes = {
      sessionId: 'session-1',
      sessionVersion: 11,
      items: [
        {
          templateId: 'offer',
          adoptedRevision: 2,
          adoptedContentHash: 'baseline-hash',
          localHash: 'local-hash',
          currentRevision: 3,
          currentContentHash: 'current-hash',
          withdrawn: false,
          adoptedRevisionWithdrawn: false,
          status: 'current',
          fields: [],
          notice: 'Update available',
        },
      ],
    };
    const finished: CatalogueImportSession = { ...session, status: 'Imported' };
    (getCatalogueImportSession as jest.Mock).mockResolvedValue(finished);
    (getCatalogueRevisionChanges as jest.Mock).mockResolvedValue(changes);
    const { result } = renderHook(() => useCatalogueImportWorkspace({ ...options, sessionId: 'session-1' }));
    await waitFor(() => expect(result.current.revisionChanges).toEqual(changes));

    await act(async () => result.current.applyRevisionFields(changes.items[0], ['name', 'description']));
    expect(applyCatalogueRevisionChanges).toHaveBeenCalledWith('session-1', {
      expectedSessionVersion: 11,
      templateId: 'offer',
      adoptedRevision: 2,
      currentRevision: 3,
      currentContentHash: 'current-hash',
      expectedLocalHash: 'local-hash',
      fieldPaths: ['name', 'description'],
    });
    expect(getCatalogueRevisionChanges).toHaveBeenCalledTimes(2);
  });

  it('surfaces revision refresh failure and retries to a valid empty result', async () => {
    const emptyChanges = { sessionId: 'session-1', sessionVersion: 8, items: [] };
    (getCatalogueImportSession as jest.Mock).mockResolvedValue({ ...session, status: 'Imported' });
    (getCatalogueRevisionChanges as jest.Mock)
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(emptyChanges);
    const { result } = renderHook(() => useCatalogueImportWorkspace({ ...options, sessionId: 'session-1' }));

    await waitFor(() =>
      expect(result.current.revisionChangesState.error).toBe('catalogue_revision_changes_load_error'),
    );
    expect(result.current.revisionChanges).toBeNull();
    expect(result.current.revisionChangesState.status).toBe('error');

    await act(async () => result.current.revisionChangesState.retry());

    expect(result.current.revisionChanges).toEqual(emptyChanges);
    expect(result.current.revisionChangesState.status).toBe('loaded');
    expect(result.current.revisionChangesState.error).toBeNull();
  });

  it('surfaces a polling failure and retries the session refresh', async () => {
    const importing: CatalogueImportSession = { ...session, status: 'Importing' };
    const imported: CatalogueImportSession = { ...session, status: 'Imported' };
    (getCatalogueImportSession as jest.Mock)
      .mockResolvedValueOnce(importing)
      .mockRejectedValueOnce(new Error('temporary status outage'))
      .mockResolvedValueOnce(imported);
    jest.useFakeTimers();
    const { result } = renderHook(() => useCatalogueImportWorkspace({ ...options, sessionId: 'session-1' }));

    await waitFor(() => expect(result.current.session?.status).toBe('Importing'));
    await act(async () => jest.advanceTimersByTimeAsync(2_000));
    expect(result.current.error).toBe('catalogue_import_load_error');

    await act(async () => jest.advanceTimersByTimeAsync(2_000));

    expect(result.current.session?.status).toBe('Imported');
    expect(result.current.error).toBeNull();
    expect(getCatalogueImportSession).toHaveBeenCalledTimes(3);
  });
});
