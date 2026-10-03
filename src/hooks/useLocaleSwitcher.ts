import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import baseI18n from '../i18n';
import { saveLanguagePreference } from '@/services/userService';
import { persistTenantLocalePreference } from '@/lib/tenantLocalePreferences';
import { changeLocaleWhenReady, LOCALE_LOAD_FAILED_EVENT, notifyLocaleLoadFailure } from '@/lib/changeLocaleWhenReady';
import { loadLocaleMessages, normalizeBundleLocale } from '@/lib/localeResourceLoader';
import type { LanguageCode } from '@/config/languageConfig';

export function useLocaleSwitcher(i18n: typeof baseI18n, hasUser: boolean, onSuccess: () => void) {
  const router = useRouter();
  const [localeLoadFailed, setLocaleLoadFailed] = useState(false);
  const localeChangeGeneration = useRef(0);

  useEffect(() => {
    const handleLocaleLoadFailure = () => setLocaleLoadFailed(true);
    window.addEventListener(LOCALE_LOAD_FAILED_EVENT, handleLocaleLoadFailure);
    return () => window.removeEventListener(LOCALE_LOAD_FAILED_EVENT, handleLocaleLoadFailure);
  }, []);

  const changeLanguage = useCallback(
    async (lng: LanguageCode): Promise<boolean> => {
      const generation = ++localeChangeGeneration.current;
      setLocaleLoadFailed(false);
      const targets = i18n === baseI18n ? [i18n] : [i18n, baseI18n];
      const previousLocales = targets.map((target) =>
        normalizeBundleLocale(target.resolvedLanguage || target.language || 'en'),
      );
      let messages: Record<string, unknown>;
      try {
        messages = await loadLocaleMessages(normalizeBundleLocale(lng));
      } catch (loadError: unknown) {
        // Dynamic chunk details are internal; this path displays localized recovery copy.
        void loadError;
        if (generation === localeChangeGeneration.current) {
          setLocaleLoadFailed(true);
          notifyLocaleLoadFailure(lng);
        }
        return false;
      }
      if (generation !== localeChangeGeneration.current) return false;

      targets.forEach((target) => {
        if (!target.hasResourceBundle(lng, 'translation')) {
          target.addResourceBundle(lng, 'translation', messages, true, true);
        }
      });
      const ready = await Promise.all(
        targets.map((target) => changeLocaleWhenReady(target, lng, normalizeBundleLocale(lng))),
      );
      if (generation !== localeChangeGeneration.current) return false;
      if (ready.some((result) => !result)) {
        await Promise.all(
          targets.map((target, index) =>
            ready[index]
              ? changeLocaleWhenReady(target, previousLocales[index], previousLocales[index])
              : Promise.resolve(false),
          ),
        );
        setLocaleLoadFailed(true);
        notifyLocaleLoadFailure(lng);
        return false;
      }

      persistTenantLocalePreference(lng);
      onSuccess();
      if (hasUser) void saveLanguagePreference(lng);
      return true;
    },
    [hasUser, i18n, onSuccess],
  );

  const handleLocaleLinkClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, lng: LanguageCode, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.currentTarget.target === '_blank'
      ) {
        return;
      }

      event.preventDefault();
      void changeLanguage(lng).then((ready) => {
        if (ready) router.push(href);
      });
    },
    [changeLanguage, router],
  );

  return { changeLanguage, handleLocaleLinkClick, localeLoadFailed };
}
