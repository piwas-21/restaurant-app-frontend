interface LocaleSwitchTarget {
  readonly language: string | undefined;
  readonly resolvedLanguage?: string | undefined;
  changeLanguage(language: string): Promise<unknown>;
  hasResourceBundle(language: string, namespace: string): boolean;
}

export const LOCALE_LOAD_FAILED_EVENT = 'tenant-locale-load-failed';

const switchGenerations = new WeakMap<LocaleSwitchTarget, number>();

export function notifyLocaleLoadFailure(locale: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCALE_LOAD_FAILED_EVENT, { detail: { locale } }));
  }
}

/** Keep the active locale when its on-demand translation chunk cannot be loaded. */
export async function changeLocaleWhenReady(
  instance: LocaleSwitchTarget,
  locale: string,
  baseLocale: string,
): Promise<boolean> {
  const generation = (switchGenerations.get(instance) ?? 0) + 1;
  switchGenerations.set(instance, generation);
  const previousLocale = instance.resolvedLanguage || instance.language || baseLocale;
  if (toBaseLocale(previousLocale) === baseLocale && instance.hasResourceBundle(baseLocale, 'translation')) return true;

  try {
    await instance.changeLanguage(locale);
  } catch (loadError: unknown) {
    // Dynamic chunk paths are internal; the caller turns false into localized user-facing copy.
    void loadError;
    if (switchGenerations.get(instance) === generation) {
      await restoreLocale(instance, previousLocale);
    }
    return false;
  }

  if (switchGenerations.get(instance) !== generation) return false;
  if (instance.hasResourceBundle(baseLocale, 'translation')) return true;

  await restoreLocale(instance, previousLocale);
  return false;
}

function toBaseLocale(locale: string): string {
  return locale.toLowerCase().split('-')[0];
}

async function restoreLocale(instance: LocaleSwitchTarget, locale: string): Promise<void> {
  try {
    await instance.changeLanguage(locale);
  } catch (restoreError: unknown) {
    // Restoration is best-effort; the caller reports the original failure with localized copy.
    void restoreError;
  }
}
