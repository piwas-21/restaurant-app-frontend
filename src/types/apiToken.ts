/**
 * Scoped API tokens — machine credentials an admin mints for an agent or a script.
 *
 * Mirrors the backend contract in `docs/plans/API-TOKENS-PLAN.md` §8
 * (backend `Features/ApiTokens/Dtos/`). The plaintext `token` exists on the
 * CREATE response only — it is returned once and stored nowhere.
 */

/** The seven scopes the backend accepts (`ApiTokenScopes.All`). */
export const API_TOKEN_SCOPES = [
  'menu:read',
  'menu:write',
  'orders:read',
  'orders:write',
  'reservations:read',
  'reservations:write',
  'tenant:read',
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

/** Derived server-side; never computed from the browser clock. */
export type ApiTokenStatus = 'active' | 'expired' | 'revoked';

export interface ApiToken {
  id: string;
  name: string;
  /** First 12 chars of the plaintext, e.g. `sk_live_a1b2` — display only. */
  prefix: string;
  scopes: ApiTokenScope[];
  expiresAt: string;
  createdAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  status: ApiTokenStatus;
}

/** The create response — the ONLY place `token` is ever populated. */
export interface CreatedApiToken extends Omit<ApiToken, 'status'> {
  token: string;
  status?: ApiTokenStatus;
}

export interface CreateApiTokenRequest {
  name: string;
  scopes: ApiTokenScope[];
  /** 1–365, validated by the backend; the UI defaults to 30. */
  expiresInDays: number;
}

export const API_TOKEN_EXPIRY_MIN_DAYS = 1;
export const API_TOKEN_EXPIRY_MAX_DAYS = 365;
export const API_TOKEN_EXPIRY_DEFAULT_DAYS = 30;
export const API_TOKEN_NAME_MAX_LENGTH = 100;
