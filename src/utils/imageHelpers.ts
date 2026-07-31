import type { MenuItem } from '@/types/menu';
import type { LanguageCode } from '@/components/LanguageSwitcher';

/**
 * Fallback image for menu items with no photo — the per-tenant branding asset
 * (`/branding/placeholder.png`) so a tenant can override it like its favicon / hero.
 * The repo default is the SofraPiwas placeholder, which every tenant inherits; RUMI's
 * own is applied to RUMI's image alone by build-image.yml's prod job. (It was the other
 * way round until O6: RUMI's was the default and the demo had to override it.)
 * Re-exported from config so it stays a single source of truth.
 */
export { BRANDING_PLACEHOLDER as FALLBACK_IMAGE } from '@/lib/config';

/**
 * Gets image gallery for a menu item
 */
export function getMenuItemImages(
  menuItem: MenuItem | null,
  currentLanguage: LanguageCode,
): Array<{ url: string; alt: string }> {
  if (!menuItem) return [];

  if (menuItem.images && menuItem.images.length > 0) {
    return menuItem.images;
  }

  const altText =
    menuItem.content?.[currentLanguage]?.name || menuItem.content?.en?.name || menuItem.name || 'Menu item image';

  return [{ url: menuItem.image, alt: altText }];
}
