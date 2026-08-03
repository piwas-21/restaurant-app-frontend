'use client';

import { useEffect, useState } from 'react';
import { apiClient, getErrorMessage } from '@/utils/apiClient';

interface ServiceVersion {
  service: string;
  commit: string;
  buildTime: string;
  environment?: string;
  uptimeSeconds?: number;
}

interface BackendUnreachable {
  reachable: false;
  error: string;
}

interface VersionResponse {
  frontend: ServiceVersion;
  backend: ServiceVersion | BackendUnreachable;
}

interface DiagnosticsResponse {
  service: string;
  commit: string;
  buildTime: string;
  environment: string;
  framework: string;
  host: string;
  serverTimeUtc: string;
  startedUtc: string;
  uptimeSeconds: number;
  database: {
    canConnect: boolean;
    lastAppliedMigration: string | null;
    pendingMigrations: number;
    error: string | null;
  };
}

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useFetchState<T>(fetcher: () => Promise<T>): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    setState((prev) => (prev.loading ? prev : { data: null, loading: true, error: null }));

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // The one surface where the RAW client-side text is wanted: this panel exists to
          // diagnose, and it is not shown to a customer in any language. Both legs land here and
          // they fail in different shapes — `fetchDiagnostics` goes through `apiClient`, so
          // `getErrorMessage` reads the server's reason; `fetchVersion` uses raw `fetch` and
          // throws a plain `Error` whose message ("version endpoint returned 502") IS the finding,
          // and `getErrorMessage` returns null for that by design.
          //
          // The SECOND operator is the one that has to be `||`: the ternary yields `''` for an
          // `ApiError`, and `'' ?? 'Unknown error'` keeps the empty string. `getErrorMessage`
          // itself returns `null`, never `''`, so the first could be either.
          //
          // When neither leg has words — a dead backend gives `ApiError(0, '')` — `status` and
          // `cause` are still on the error and are what this panel would most like to show.
          // Surfacing them is a follow-up, not something to fake with a sentence.
          const error = getErrorMessage(err) || (err instanceof Error ? err.message : '') || 'Unknown error';
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetcher]);

  return state;
}

async function fetchVersion(): Promise<VersionResponse> {
  const res = await fetch('/api/frontend/version', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`version endpoint returned ${res.status}`);
  }
  return (await res.json()) as VersionResponse;
}

async function fetchDiagnostics(): Promise<DiagnosticsResponse> {
  return apiClient.get<DiagnosticsResponse>('/api/diagnostics');
}

export function useDevPortalData() {
  const version = useFetchState(fetchVersion);
  const diagnostics = useFetchState(fetchDiagnostics);

  return { version, diagnostics };
}
