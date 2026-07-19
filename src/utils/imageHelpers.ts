import type { MenuItem } from '@/types/menu';
import type { LanguageCode } from '@/components/LanguageSwitcher';
import { BRANDING_PLACEHOLDER } from '@/lib/config';

/**
 * Fallback image for menu items with no photo. Points at the per-tenant branding
 * asset (`/branding/placeholder.png`) so a tenant can override it like its logo /
 * icon — the demo (craft) ships a Sofra placeholder, prod keeps the RUMI default.
 */
export const FALLBACK_IMAGE = BRANDING_PLACEHOLDER;

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
