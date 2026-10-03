'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';

export interface LocaleTranslationLoad {
  readonly ready: boolean;
  readonly failed: boolean;
  readonly retry: () => void;
}

export type LocaleTranslationLoader = (instance: I18nInstance, language: string | undefined) => Promise<void>;

interface TranslationLoadState {
  readonly language: string;
  readonly attempt: number;
  readonly status: 'disabled' | 'loading' | 'ready' | 'failed';
}

/** Load route-scoped locale resources with explicit retry and a fail-closed ready state. */
export function useLazyLocaleTranslations(
  enabled: boolean,
  loadBundle: LocaleTranslationLoader,
): LocaleTranslationLoad {
  const { i18n } = useTranslation();
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? 'en';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TranslationLoadState>({ language: '', attempt: -1, status: 'loading' });

  useEffect(() => {
    if (!enabled) {
      setState({ language, attempt, status: 'disabled' });
      return;
    }
    if (!i18n) {
      setState({ language, attempt, status: 'ready' });
      return;
    }
    let active = true;
    setState({ language, attempt, status: 'loading' });
    void loadBundle(i18n, language).then(
      () => {
        if (active) setState({ language, attempt, status: 'ready' });
      },
      () => {
        if (active) setState({ language, attempt, status: 'failed' });
      },
    );
    return () => {
      active = false;
    };
  }, [i18n, language, enabled, attempt, loadBundle]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const stateIsCurrent = state.language === language && state.attempt === attempt;
  return {
    ready: !enabled || !i18n || (stateIsCurrent && state.status === 'ready'),
    failed: enabled && stateIsCurrent && state.status === 'failed',
    retry,
  };
}
