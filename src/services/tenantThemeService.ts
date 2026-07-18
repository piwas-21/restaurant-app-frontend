import { paletteToCss } from '@/design-system/palettes';
import type { ApiResponse, RestaurantInfoDto } from '@/types/restaurantInfo';

// Server-side tenant-theme service. Uses a raw `fetch` (NOT apiClient) on purpose:
// it runs in the RSC layout render and needs Next's ISR fetch-cache options
// (`next: { revalidate, tags }`), which apiClient — a client-side module that reads
// localStorage and does token refresh — cannot provide. This is the sanctioned
// "service file that wraps the RSC-specific caching options" for the one server
// read the app makes (ADR-007).
const SERVER_API_BASE = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5221';

/**
 * Fetch the tenant's palette key and return the CSS the root layout injects
 * (ADR-007). ISR-cached (revalidate 30s, tagged 'tenant-theme' so a palette save
 * can refresh it immediately). ANY failure — unreachable backend, non-OK, malformed
 * body — resolves to '' (the SAFE DEFAULT: the baked template palette renders
 * unchanged, so a theming error can never break the page).
 */
export async function getTenantPaletteCss(): Promise<string> {
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/restaurant-info`, {
      next: { revalidate: 30, tags: ['tenant-theme'] },
    });
    if (!res.ok) return '';
    const body = (await res.json()) as ApiResponse<RestaurantInfoDto>;
    return paletteToCss(body?.data?.themePaletteKey ?? null);
  } catch {
    return '';
  }
}
