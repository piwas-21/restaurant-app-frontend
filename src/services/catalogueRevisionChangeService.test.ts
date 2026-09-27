import { apiClient } from '@/utils/apiClient';
import { applyCatalogueRevisionChanges, getCatalogueRevisionChanges } from './catalogueRevisionChangeService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient') as typeof import('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn() } };
});

beforeEach(() => jest.clearAllMocks());

describe('catalogueRevisionChangeService', () => {
  it('reads revision changes with the current session and local text hashes', async () => {
    const response = {
      sessionId: 'session-3',
      sessionVersion: 8,
      items: [
        {
          templateId: 'meal',
          adoptedRevision: 2,
          adoptedContentHash: 'adopted-hash',
          currentRevision: 3,
          currentContentHash: 'current-hash',
          withdrawn: false,
          adoptedRevisionWithdrawn: false,
          status: 'current',
          fields: [{ path: 'name', baseline: 'Old', current: 'New', localValue: 'Old', localChanged: false }],
          localHash: 'local-hash',
          notice: 'Update available',
        },
      ],
    };
    jest.mocked(apiClient.get).mockResolvedValue(response);

    await expect(getCatalogueRevisionChanges('session-3')).resolves.toEqual(response);
    expect(apiClient.get).toHaveBeenCalledWith('/api/catalogue/import-sessions/session-3/revision-changes', {
      requireAuth: true,
    });
  });

  it('applies only selected revision paths with the exact session and local hashes', async () => {
    const request = {
      expectedSessionVersion: 8,
      templateId: 'meal',
      adoptedRevision: 2,
      currentRevision: 3,
      currentContentHash: 'central-current-hash',
      expectedLocalHash: 'local-snapshot-hash',
      fieldPaths: ['name', 'sections.main.description'],
    };
    const response = {
      sessionId: 'session-3',
      sessionVersion: 9,
      templateId: 'meal',
      adoptedRevision: 3,
      contentHash: 'central-current-hash',
      appliedFieldPaths: request.fieldPaths,
      localHash: 'new-local-hash',
    };
    jest.mocked(apiClient.post).mockResolvedValue(response);

    await expect(applyCatalogueRevisionChanges('session/3', request)).resolves.toEqual(response);
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/catalogue/import-sessions/session%2F3/revision-changes/apply',
      request,
      { requireAuth: true },
    );
  });
});
