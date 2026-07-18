'use server';

import { revalidateTag } from 'next/cache';

/**
 * Bust the SSR palette cache (the `tenant-theme` fetch tag in
 * `src/lib/tenantTheme.ts`) so a palette change made in the admin reflects on the
 * very next page load, not after the 30s ISR fallback window (ADR-007). Called
 * from the Appearance tab after a successful save.
 */
export async function revalidateTenantTheme(): Promise<void> {
  revalidateTag('tenant-theme');
}
