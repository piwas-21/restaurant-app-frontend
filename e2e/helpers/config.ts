/**
 * Shared E2E config. Single source of truth for the backend API URL so
 * fixtures and tests don't drift on the env-var name.
 *
 * The DB connection (E2E_DATABASE_URL) is intentionally a separate concern
 * and is read inside e2e/helpers/db.ts.
 */
export function apiBaseUrl(): string {
  return process.env.E2E_API_BASE_URL ?? 'http://localhost:5221';
}
