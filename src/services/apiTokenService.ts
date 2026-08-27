import { apiClient } from '@/utils/apiClient';
import type { ApiToken, CreateApiTokenRequest, CreatedApiToken } from '@/types/apiToken';

/** Standard backend envelope (`ApiResponse<T>`); `errors[]` carries the 400 reasons. */
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

const ENDPOINTS = {
  API_TOKENS: '/api/ApiTokens',
  API_TOKEN_BY_ID: (id: string) => `/api/ApiTokens/${id}`,
} as const;

/**
 * Scoped API tokens (docs/plans/API-TOKENS-PLAN.md §8).
 *
 * All three calls are **admin-only and human-JWT only** — a token cannot reach this
 * controller at all (§5), so there is no self-service path here for a machine client.
 */
export const apiTokenService = {
  /** Newest first; includes revoked and expired rows. */
  async listTokens(): Promise<ApiToken[]> {
    const response = await apiClient.get<ApiResponse<ApiToken[]>>(ENDPOINTS.API_TOKENS);
    return response.data ?? [];
  },

  /**
   * 201 Created. The returned `token` is the plaintext and is returned HERE AND NOWHERE
   * ELSE — the caller must show it once and then drop it. Never log or persist it.
   */
  async createToken(request: CreateApiTokenRequest): Promise<CreatedApiToken> {
    const response = await apiClient.post<ApiResponse<CreatedApiToken>>(ENDPOINTS.API_TOKENS, request);
    return response.data;
  },

  /** Idempotent: revoking an already-revoked token is a 200, not an error. */
  async revokeToken(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<boolean>>(ENDPOINTS.API_TOKEN_BY_ID(id));
  },
};
