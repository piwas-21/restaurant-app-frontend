const STORAGE_KEY = 'server.table-round-favorites';
const MAX_FAVORITES = 24;

interface StoredFavorites {
  readonly scope?: unknown;
  readonly productIds?: unknown;
}

function tenantScope(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
}

export function serverTableRoundFavoriteScope(staffIdentity: string | null | undefined): string | null {
  const staff = staffIdentity?.trim().toLowerCase();
  const tenant = tenantScope();
  return staff && tenant ? `${tenant}|${staff}` : null;
}

export function readServerTableRoundFavorites(scope: string | null): string[] {
  if (!scope || typeof window === 'undefined') return [];
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as StoredFavorites | null;
    if (stored?.scope !== scope || !Array.isArray(stored?.productIds)) return [];
    return stored.productIds
      .filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
      .slice(0, MAX_FAVORITES);
  } catch (error: unknown) {
    console.warn('Could not restore server favorites', error);
    return [];
  }
}

export function persistServerTableRoundFavorites(scope: string | null, productIds: readonly string[]): void {
  if (!scope || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ scope, productIds: [...new Set(productIds)].slice(0, MAX_FAVORITES) }),
    );
  } catch (error: unknown) {
    // Favorites are an optional shortcut; catalogue ordering remains fully usable without storage.
    console.warn('Could not persist server favorites', error);
  }
}
