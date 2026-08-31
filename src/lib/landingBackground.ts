import type { LandingPageDto } from '@/types/landingPage';

/**
 * How the hero background resolves, by the admin's chosen mode:
 *
 *  - `default` — the baked, tenant-neutral platform artwork;
 *  - `custom`  — the restaurant's own upload (`backgroundImageUrl`, absolute, null unless this
 *    mode is active; falls back to the platform artwork if the upload disappeared, so a hero
 *    never renders empty by surprise);
 *  - `none`    — no image at all: the section falls back to its own background colour. This is
 *    the "remove the background" end of the admin control, a deliberate state rather than an
 *    error.
 *
 * A tenant that has not configured anything reads `default` (the backend column default), which
 * keeps the pre-contract behaviour byte-for-byte.
 */
export function landingBackgroundUrl(
  landing: Pick<LandingPageDto, 'backgroundMode' | 'backgroundImageUrl'> | null | undefined,
  platformDefault: string,
): string | null {
  if (!landing || landing.backgroundMode === 'default') return platformDefault;
  if (landing.backgroundMode === 'custom') return landing.backgroundImageUrl ?? platformDefault;
  return null;
}

/**
 * The copy overrides for one visitor language. Exact code first (`pt-BR`), then the base
 * language (`pt`), then nothing — null means every string falls back to the bundled i18n copy.
 */
export function landingOverridesFor(
  landing: Pick<LandingPageDto, 'content'> | null | undefined,
  language: string | null | undefined,
): LandingPageDto['content'][string] | null {
  if (!landing || !language) return null;
  const content = landing.content;
  if (content[language]) return content[language];
  const base = language.split('-')[0];
  return content[base] ?? null;
}
