import type { i18n as I18nInstance } from 'i18next';

export type LocaleBundleLoaders = Readonly<
  Record<string, () => Promise<{ readonly default: Readonly<Record<string, unknown>> }>>
>;

const pendingLoads = new WeakMap<I18nInstance, Map<string, Promise<void>>>();

/** Merge one lazily imported partial translation bundle into the active i18next resource store. */
export function loadLazyLocaleBundle(
  instance: I18nInstance,
  language: string | undefined,
  bundleId: string,
  loaders: LocaleBundleLoaders,
  fallbackLocale = 'en',
): Promise<void> {
  const languageBase = language?.split(/[-_]/, 1)[0]?.toLowerCase();
  const locale = languageBase && Object.hasOwn(loaders, languageBase) ? languageBase : fallbackLocale;
  const loader = loaders[locale];
  if (!loader) return Promise.reject(new Error(`No ${bundleId} locale bundle for ${locale}`));

  let instanceLoads = pendingLoads.get(instance);
  if (!instanceLoads) {
    instanceLoads = new Map<string, Promise<void>>();
    pendingLoads.set(instance, instanceLoads);
  }
  const key = `${bundleId}\u0000${locale}`;
  const existingLoad = instanceLoads.get(key);
  if (existingLoad) return existingLoad;

  const load = loader()
    .then(({ default: bundle }) => {
      instance.addResourceBundle(locale, 'translation', bundle, true, true);
    })
    .catch((reason: unknown) => {
      // Failed chunk fetches remain retryable and do not discard other feature resources.
      instanceLoads.delete(key);
      throw reason;
    });
  instanceLoads.set(key, load);
  return load;
}
