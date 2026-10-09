import en from './en.json';
import de from './de.json';
import fr from './fr.json';
import nl from './nl.json';
import tr from './tr.json';
import ar from './ar.json';
import es from './es.json';
import italian from './it.json';
import ru from './ru.json';
import zh from './zh.json';

type TranslationMap = Readonly<Record<string, string>>;

function flatten(value: unknown, prefix = ''): TranslationMap {
  if (typeof value === 'string') return { [prefix]: value };
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Invalid locale value at ${prefix || 'root'}`);
  }

  return Object.entries(value).reduce<TranslationMap>(
    (result, [key, nested]) => ({ ...result, ...flatten(nested, prefix ? `${prefix}.${key}` : key) }),
    {},
  );
}

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort();
}

const bundles = { de, fr, nl, tr, ar, es, it: italian, ru, zh } as const;
const english = flatten(en.accountPayments);

describe('account payment lazy locale bundles', () => {
  Object.entries(bundles).forEach(([locale, bundle]) => {
    it(`keeps the ${locale} sidecar complete and interpolation-safe`, () => {
      const translated = flatten(bundle.accountPayments);

      expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(translated)) {
        expect(value.trim()).not.toBe('');
        expect(placeholders(value)).toEqual(placeholders(english[key]));
      }
    });
  });

  it('distinguishes replaying the saved request from checking its result', () => {
    expect(english.retry_original).toBe('Retry the original request');
    expect(english.retry_original).not.toBe(english.check_result);
  });
});
