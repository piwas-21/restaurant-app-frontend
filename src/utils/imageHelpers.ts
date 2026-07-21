import type { MenuItem } from '@/types/menu';
import type { LanguageCode } from '@/components/LanguageSwitcher';

/**
 * Fallback image for menu items with no photo — the per-tenant branding asset
 * (`/branding/placeholder.png`) so a tenant can override it like its logo / icon.
 * The demo (craft) ships a SofraPiwas placeholder; prod keeps the RUMI default.
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
