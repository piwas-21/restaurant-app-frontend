import type { MetadataRoute } from 'next';
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR, RESTAURANT_NAME } from '@/lib/config';

/** Characters a phone launcher shows before it truncates. */
const SHORT_NAME_MAX = 12;

/**
 * Web app manifest — the thing that makes this app installable at all (there was none before).
 *
 * App Router convention: this file is served at `/manifest.webmanifest` and Next injects the
 * `<link rel="manifest">` into every page, so the root layout needs no change.
 *
 * TENANT-AWARE by construction: the name comes from the same baked `RESTAURANT_NAME` the title
 * uses (issue #125), and the icons point at `/branding/`, the directory
 * `.github/workflows/build-tenant-image.yml` overwrites per tenant. Nothing here says "RUMI".
 *
 * `short_name` is what a phone launcher shows under the icon; it is clipped hard by the OS, so it
 * is truncated rather than left to be cut mid-word by the launcher.
 */
/** Launcher label: a phone clips it hard, so prefer the first word over a mid-word cut. */
export function toShortName(name: string): string {
  if (name.length <= SHORT_NAME_MAX) return name;
  const firstWord = name.split(/\s+/)[0];
  if (firstWord && firstWord.length <= SHORT_NAME_MAX) return firstWord;
  return `${name.slice(0, SHORT_NAME_MAX - 1).trimEnd()}…`;
}

export default function manifest(): MetadataRoute.Manifest {
  const shortName = toShortName(RESTAURANT_NAME);
  return {
    name: RESTAURANT_NAME,
    short_name: shortName,
    description: `${RESTAURANT_NAME} - Experience authentic flavors.`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    icons: [
      // The tenant-overridable vector first: `sizes: 'any'` is how a scalable icon is declared.
      { src: '/branding/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      // Raster fallbacks. These exist because Chromium's installability check wants a raster icon
      // of at least 144px and we did not want the install prompt to depend on an unverified claim
      // about SVG support. NOTE for whoever extends the tenant branding contract: today
      // build-tenant-image.yml copies only icon.svg / hero.png / placeholder.png, so a tenant that
      // overrides its branding keeps the PLATFORM onion in these three files until that list grows.
      { src: '/branding/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/branding/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/branding/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
