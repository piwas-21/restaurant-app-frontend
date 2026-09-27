import { apiClient } from '@/utils/apiClient';
import { recordMenuAuthoringMatchDecision, searchMenuAuthoring } from './menuAuthoringSearchService';

jest.mock('@/utils/apiClient', () => {
  const actual = jest.requireActual('@/utils/apiClient') as typeof import('@/utils/apiClient');
  return { ...actual, apiClient: { get: jest.fn(), post: jest.fn() } };
});

beforeEach(() => jest.clearAllMocks());

describe('menuAuthoringSearchService', () => {
  it('sends bounded tenant search and kind filters through authenticated apiClient', async () => {
    const page = { items: [], nextCursor: null };
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: page });

    await expect(searchMenuAuthoring({ query: '  jalapeño  ', forKind: 'sauce', limit: 24 })).resolves.toEqual(page);
    expect(apiClient.get).toHaveBeenCalledWith('/api/MenuAuthoring/search?q=jalape%C3%B1o&limit=24&forKind=sauce', {
      requireAuth: true,
    });
  });

  it('passes cursors and abort signals without changing the query', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { items: [], nextCursor: null } });
    const controller = new AbortController();
    await searchMenuAuthoring({ query: 'zaatar', cursor: 'cursor/2', limit: 24 }, controller.signal);
    expect(apiClient.get).toHaveBeenCalledWith('/api/MenuAuthoring/search?q=zaatar&limit=24&cursor=cursor%2F2', {
      requireAuth: true,
      signal: controller.signal,
    });
  });

  it('records an explicit accepted alias decision', async () => {
    jest.mocked(apiClient.post).mockResolvedValue({ success: true, data: {} });
    await recordMenuAuthoringMatchDecision({
      query: 'piment doux',
      candidateType: 'ingredient',
      candidateId: 'ingredient-4',
      decision: 'accept',
      alias: 'piment doux',
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/MenuAuthoring/match-decisions',
      {
        query: 'piment doux',
        candidateType: 'ingredient',
        candidateId: 'ingredient-4',
        decision: 'accept',
        alias: 'piment doux',
      },
      { requireAuth: true },
    );
  });

  it('surfaces an unsuccessful search envelope', async () => {
    jest.mocked(apiClient.get).mockResolvedValue({ success: false, message: 'Search is unavailable' });
    await expect(searchMenuAuthoring({ query: 'naan' })).rejects.toThrow('Search is unavailable');
  });
});
