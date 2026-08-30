import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import manifest, { toShortName } from './manifest';
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR, RESTAURANT_NAME } from '@/lib/config';

/**
 * The manifest is what makes the app installable, so the two things that can silently break it are
 * pinned: the icon set Chromium's installability check reads, and the tenant name.
 */
describe('web app manifest', () => {
  const result = manifest();

  it('is a standalone, root-scoped app named after the tenant', () => {
    expect(result.name).toBe(RESTAURANT_NAME);
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
    expect(result.scope).toBe('/');
    expect(result.theme_color).toBe(PWA_THEME_COLOR);
    expect(result.background_color).toBe(PWA_BACKGROUND_COLOR);
  });

  /**
   * Asserted against the SOURCE, not the output: with no `NEXT_PUBLIC_RESTAURANT_NAME` in the test
   * env the name is the generic fallback, so a check on the rendered JSON would pass for the wrong
   * reason — and would go red on a build that is legitimately named RUMI.
   */
  it('never hardcodes a tenant name in the source', () => {
    const source = readFileSync(join(__dirname, 'manifest.ts'), 'utf8');
    expect(source).not.toMatch(/RUMI Restaurant|rumirestaurant/i);
    expect(source).toContain('RESTAURANT_NAME');
  });

  it('ships a raster icon at 192 and 512 plus a maskable one', () => {
    const icons = result.icons ?? [];
    const sizes = icons.filter((icon) => icon.type === 'image/png').map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  });

  it('shortens a long tenant name at a word boundary, not mid-word', () => {
    expect(toShortName('RUMI')).toBe('RUMI');
    expect(toShortName('RUMI Restaurant')).toBe('RUMI');
    // No usable first word: fall back to a marked truncation rather than a silent cut.
    expect(toShortName('Bistroquetterie')).toBe('Bistroquett…');
  });

  it('points every icon at the tenant-overridable /branding directory', () => {
    for (const icon of result.icons ?? []) {
      expect(icon.src.startsWith('/branding/')).toBe(true);
    }
  });
});
