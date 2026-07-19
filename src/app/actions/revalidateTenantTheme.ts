'use server';

import { revalidateTag } from 'next/cache';

/**
 * Bust the SSR palette cache (the `tenant-theme` fetch tag in
 * `src/services/tenantThemeService.ts`) so a palette change made in the admin
 * reflects on the very next page load, not after the 30s ISR fallback window
 * (ADR-007). Called from the Appearance tab after a successful save.
 *
 * Intentionally public / no authZ: it only invalidates a cache of the PUBLIC
 * `GET /api/restaurant-info` (`[AllowAnonymous]`) — it mutates no data and leaks
 * nothing, so the worst an anonymous caller can do is force a re-fetch of already
 * public data. A real guard would need a server session this token-in-localStorage
 * app doesn't have, for no security gain.
 */
export async function revalidateTenantTheme(): Promise<void> {
  revalidateTag('tenant-theme');
}
