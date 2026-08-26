'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { apiTokenService } from '@/services/apiTokenService';
import { getErrorMessage } from '@/utils/apiClient';
import type { ApiToken, CreateApiTokenRequest, CreatedApiToken } from '@/types/apiToken';

/**
 * Page logic for `/admin/api-tokens` (CLAUDE.md §5 rule 1).
 *
 * Two things here are load-bearing:
 *  - `createdToken` holds the ONE copy of the plaintext that will ever exist. It lives in
 *    component state only, is never written to storage, and is dropped the moment the admin
 *    confirms they stored it.
 *  - every failure sentence comes from `getErrorMessage`, which joins the backend's
 *    `errors[]` — so a 400 says "expiresInDays must be between 1 and 365", not "failed".
 */
export function useApiTokens() {
  const { t } = useTranslation();
  // `t` is NOT a stable identity across renders — i18next hands back a new function on a language
  // change, and a test double hands back one on EVERY render. Naming it in the dependency list of
  // `loadTokens` therefore rebuilt the callback, which re-fired the mount effect, which set state:
  // an endless GET loop against `/api/ApiTokens`. Read it through a ref instead.
  const tRef = useRef(t);
  tRef.current = t;
  const { enqueueSnackbar } = useSnackbar();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<CreatedApiToken | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true);
      setTokens(await apiTokenService.listTokens());
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err) ?? tRef.current('api_tokens_load_failed'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  const openCreate = useCallback(() => {
    setCreateError(null);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
    setCreateError(null);
  }, []);

  const createToken = useCallback(
    async (request: CreateApiTokenRequest) => {
      setCreating(true);
      setCreateError(null);
      try {
        const created = await apiTokenService.createToken(request);
        setCreateOpen(false);
        // Reveal BEFORE the refresh: the list call must never be what the plaintext waits on.
        setCreatedToken(created);
        await loadTokens();
      } catch (err) {
        setCreateError(getErrorMessage(err) ?? tRef.current('api_tokens_create_failed'));
      } finally {
        setCreating(false);
      }
    },
    [loadTokens],
  );

  /** The admin has confirmed they stored it — forget the plaintext. */
  const dismissCreatedToken = useCallback(() => setCreatedToken(null), []);

  const requestRevoke = useCallback((token: ApiToken) => setRevokeTarget(token), []);
  const cancelRevoke = useCallback(() => setRevokeTarget(null), []);

  const confirmRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await apiTokenService.revokeToken(revokeTarget.id);
      enqueueSnackbar(tRef.current('api_tokens_revoked'), { variant: 'success' });
      setRevokeTarget(null);
      await loadTokens();
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err) ?? tRef.current('api_tokens_revoke_failed'), { variant: 'error' });
    } finally {
      setRevoking(false);
    }
  }, [enqueueSnackbar, loadTokens, revokeTarget]);

  return {
    tokens,
    loading,
    createOpen,
    creating,
    createError,
    createdToken,
    revokeTarget,
    revoking,
    openCreate,
    closeCreate,
    createToken,
    dismissCreatedToken,
    requestRevoke,
    cancelRevoke,
    confirmRevoke,
  };
}
