'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/utils/apiClient';

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

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const error = err instanceof Error ? err.message : 'Unknown error';
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
  return res.json() as Promise<VersionResponse>;
}

async function fetchDiagnostics(): Promise<DiagnosticsResponse> {
  return apiClient.get<DiagnosticsResponse>('/api/diagnostics');
}

export function useDevPortalData() {
  const version = useFetchState(fetchVersion);
  const diagnostics = useFetchState(fetchDiagnostics);

  return { version, diagnostics };
}
