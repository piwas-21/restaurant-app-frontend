import { NextResponse } from 'next/server';

// This route reflects live runtime state (image build identity + a call to the
// backend), so it must never be statically optimized at build time.
export const dynamic = 'force-dynamic';

// Build identity is baked into the image at docker-build time (GIT_SHA /
// BUILD_TIME build-args -> ENV, see Dockerfile + build-image.yml). These are
// server-only env vars (NOT NEXT_PUBLIC_*) read at request time on the server.
const COMMIT = process.env.GIT_SHA ?? 'unknown';
const BUILD_TIME = process.env.BUILD_TIME ?? 'unknown';

const BACKEND_TIMEOUT_MS = 2000;

const shortSha = (sha: string): string => (sha.length >= 7 ? sha.slice(0, 7) : sha);

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

// Narrow the untyped JSON from the backend before trusting it. fetch().json()
// is `any`; validating here keeps the response well-typed and shields callers
// from a backend that changes shape or returns an error envelope.
function isServiceVersion(value: unknown): value is ServiceVersion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v.service === 'string' && typeof v.commit === 'string' && typeof v.buildTime === 'string';
}

// Fetch the backend's own /api/version so a single URL surfaces both services.
// Mirrors apiClient.ts's NEXT_PUBLIC_API_URL pattern; the call is server-to-server
// at request time. Degrades gracefully — a backend outage must not 500 this route.
async function fetchBackendVersion(): Promise<ServiceVersion | BackendUnreachable> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL;
  if (!apiBase) {
    return { reachable: false, error: 'NEXT_PUBLIC_API_URL not set' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase}/api/version`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      return { reachable: false, error: `backend returned ${res.status}` };
    }
    const data: unknown = await res.json();
    if (!isServiceVersion(data)) {
      return { reachable: false, error: 'unexpected backend response shape' };
    }
    return data;
  } catch (err) {
    return { reachable: false, error: err instanceof Error ? err.message : 'unknown error' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const backend = await fetchBackendVersion();

  return NextResponse.json({
    frontend: {
      service: 'restaurant-system-frontend',
      commit: shortSha(COMMIT),
      buildTime: BUILD_TIME,
      environment: process.env.NODE_ENV,
    },
    backend,
  });
}
