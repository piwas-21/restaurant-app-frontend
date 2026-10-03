import { changeLocaleWhenReady } from './changeLocaleWhenReady';

function localeTarget(loaded: ReadonlySet<string>) {
  let language = 'en';
  const changeLanguage = jest.fn(async (next: string) => {
    language = next;
  });
  return {
    get language() {
      return language;
    },
    get resolvedLanguage() {
      return loaded.has(language) ? language : 'en';
    },
    changeLanguage,
    hasResourceBundle: (locale: string) => loaded.has(locale),
  };
}

it('restores the previous locale when the requested translation bundle failed to load', async () => {
  const instance = localeTarget(new Set(['en']));

  await expect(changeLocaleWhenReady(instance, 'de', 'de')).resolves.toBe(false);
  expect(instance.language).toBe('en');
  expect(instance.changeLanguage.mock.calls).toEqual([['de'], ['en']]);
});

it('does not let an older failed switch roll back a newer loaded locale', async () => {
  let finishGerman: (() => void) | undefined;
  let language = 'en';
  let activeChange = 0;
  const instance = {
    get language() {
      return language;
    },
    get resolvedLanguage() {
      return language === 'nl' ? 'nl' : 'en';
    },
    changeLanguage: jest.fn((next: string) => {
      const changeId = ++activeChange;
      if (next === 'de') {
        return new Promise<void>((resolve) => {
          finishGerman = () => {
            if (changeId === activeChange) language = next;
            resolve();
          };
        });
      }
      language = next;
      return Promise.resolve();
    }),
    hasResourceBundle: (locale: string) => locale === 'en' || locale === 'nl',
  };

  const german = changeLocaleWhenReady(instance, 'de', 'de');
  const dutch = changeLocaleWhenReady(instance, 'nl', 'nl');
  await expect(dutch).resolves.toBe(true);
  finishGerman?.();
  await expect(german).resolves.toBe(false);
  expect(instance.language).toBe('nl');
});
