import type { BackendModule, ResourceKey } from 'i18next';

export type LocaleMessagesLoader = (language: string) => Promise<Record<string, unknown>>;

export function createLocaleBackend(loadMessages: LocaleMessagesLoader): BackendModule {
  return {
    type: 'backend',
    init() {
      // The backend receives its immutable message loader from the factory closure.
    },
    read(language, namespace, callback) {
      if (namespace !== 'translation') {
        callback(null, {});
        return;
      }
      void loadMessages(language)
        .then((messages) => callback(null, messages as ResourceKey))
        .catch((cause: unknown) => callback(cause instanceof Error ? cause : String(cause), null));
    },
  };
}
