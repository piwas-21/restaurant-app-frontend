import { apiClient } from '@/utils/apiClient';
import { apiTokenService } from './apiTokenService';

/**
 * The wire contract of API-TOKENS-PLAN §8, pinned where it can drift silently: the endpoint
 * casing (`/api/ApiTokens`, PascalCase — a lowercase path is a 404 on the box, not a test
 * failure here), and the fact that a `data`-less envelope answers with an empty list rather
 * than `undefined` reaching `tokens.map` in the page.
 */
const mockedGet = apiClient.get as jest.Mock;
const mockedPost = apiClient.post as jest.Mock;
const mockedDelete = apiClient.delete as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('apiTokenService', () => {
  it('lists tokens from the PascalCase endpoint', async () => {
    mockedGet.mockResolvedValue({ success: true, data: [{ id: 'a' }] });

    await expect(apiTokenService.listTokens()).resolves.toEqual([{ id: 'a' }]);
    expect(mockedGet).toHaveBeenCalledWith('/api/ApiTokens');
  });

  it('answers an empty envelope with an empty list', async () => {
    mockedGet.mockResolvedValue({ success: true });

    await expect(apiTokenService.listTokens()).resolves.toEqual([]);
  });

  it('posts the create request unchanged and returns the once-only plaintext', async () => {
    mockedPost.mockResolvedValue({ success: true, data: { id: 'a', token: 'sk_live_xyz' } });
    const request = { name: 'seeder', scopes: ['menu:read' as const], expiresInDays: 30 };

    const created = await apiTokenService.createToken(request);

    expect(mockedPost).toHaveBeenCalledWith('/api/ApiTokens', request);
    expect(created.token).toBe('sk_live_xyz');
  });

  it('revokes by id', async () => {
    mockedDelete.mockResolvedValue({ success: true, data: true });

    await apiTokenService.revokeToken('abc');

    expect(mockedDelete).toHaveBeenCalledWith('/api/ApiTokens/abc');
  });
});
