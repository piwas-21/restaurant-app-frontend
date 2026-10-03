import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const locales = ['en', 'fr', 'de', 'nl', 'tr', 'ar', 'es', 'it', 'ru', 'zh'];
type Bundle = Record<string, string>;

function readBundle(locale: string): Bundle {
  return JSON.parse(readFileSync(join(__dirname, `${locale}.json`), 'utf8')) as Bundle;
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((match) => match[1]);
}

describe('table guest locale bundles', () => {
  it('keeps matching non-empty keys and interpolation placeholders in all ten locales', () => {
    const reference = readBundle('en');
    for (const locale of locales) {
      const bundle = readBundle(locale);
      expect(Object.keys(bundle).sort()).toEqual(Object.keys(reference).sort());
      for (const [key, value] of Object.entries(bundle)) {
        expect(value.trim()).not.toBe('');
        expect(placeholders(value).sort()).toEqual(placeholders(reference[key]).sort());
      }
    }
  });

  it('translates the quantity labels instead of repeating English copy', () => {
    const reference = readBundle('en');
    for (const locale of locales.filter((entry) => entry !== 'en')) {
      const bundle = readBundle(locale);
      expect(bundle.table_guest_selected_item).not.toBe(reference.table_guest_selected_item);
      expect(bundle.table_guest_extra_item).not.toBe(reference.table_guest_extra_item);
    }
  });
});
