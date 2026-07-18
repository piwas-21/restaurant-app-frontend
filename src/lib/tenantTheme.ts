import { paletteToCss } from '@/design-system/palettes';
import type { ApiResponse, RestaurantInfoDto } from '@/types/restaurantInfo';

// Server-reachable API base for the RSC render. NEXT_PUBLIC_API_URL is the public
// tenant origin (baked per image); the server reaches the backend through it (a
// Caddy hairpin on the box), which is fine for the ISR-cached call below. A deploy
// MAY set a server-only API_INTERNAL_URL (e.g. the internal compose service URL) to
// skip the hairpin. Mirrors apiClient's NEXT_PUBLIC_API_URL default.
const SERVER_API_BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5221';

/**
 * Server-side: fetch the tenant's palette key and return the CSS the root layout
 * injects (ADR-007). ISR-cached (revalidate 30s, matching useRestaurantInfo's
 * client freshness) so it costs ~nothing across requests. ANY failure —
 * unreachable backend, non-OK status, malformed body — resolves to '' (the SAFE
 * DEFAULT: the template's baked palette renders unchanged, so a theming error can
 * never break the page).
 */
export async function getTenantPaletteCss(): Promise<string> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/restaurant-info`, {
      // Tagged so a palette save can revalidate it immediately
      // (revalidateTenantTheme); the 30s window is the fallback for other changes.
      next: { revalidate: 30, tags: ['tenant-theme'] },
    });
    if (!res.ok) return '';
    const body = (await res.json()) as ApiResponse<RestaurantInfoDto>;
    return paletteToCss(body?.data?.themePaletteKey ?? null);
  } catch {
    return '';
  }
}
