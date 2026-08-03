'use client';

import { useEffect, useState } from 'react';
import { ApiError, apiClient, getErrorMessage } from '@/utils/apiClient';

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

/**
 * What this panel should print for a failure.
 *
 * Words first, then the machine-readable parts — because since #401 the most important failure
 * here has NO words: a dead backend is `ApiError(0, '')`, and "Unknown error" on the panel whose
 * job is answering "is the backend up?" is the least useful thing it could say. `status` and
 * `cause` are both on the error and cost nothing to show.
 */
function describeFailure(err: unknown): string {
  // `||` on the second operator, not `??`: the ternary yields `''` for an `ApiError`, and
  // `'' ?? …` keeps the empty string. `getErrorMessage` itself returns `null`, never `''`.
  const words = getErrorMessage(err) || (err instanceof Error ? err.message : '');
  const parts: string[] = [];
  if (err instanceof ApiError) parts.push(err.status === 0 ? 'network unreachable' : `HTTP ${err.status}`);
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause instanceof Error) parts.push(`${cause.name}: ${cause.message}`);

  const detail = parts.join(' — ');
  if (words && detail) return `${words} (${detail})`;
  return words || detail || 'Unknown error';
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
          const error = describeFailure(err);
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
