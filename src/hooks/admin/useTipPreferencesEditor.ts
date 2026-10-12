'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';
import { updateTipPreferences } from '@/services/tipPreferencesService';
import type { TipPreferences } from '@/types/tipPreferences';

export function useTipPreferencesEditor() {
  const { t, i18n } = useTranslation();
  const reader = useRestaurantInfo();
  const [mode, setMode] = useState<TipPreferences['mode']>('percentage');
  const [inputs, setInputs] = useState<string[]>(['10', '15', '20']);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const currency = reader.info?.currency ?? null;
  const locale = i18n.language || 'en';
  useEffect(() => {
    const preferences = reader.info?.tipPreferences;
    if (!preferences) return;
    setMode(preferences.mode);
    setInputs(preferences.values.map((value) => String(preferences.mode === 'fixed' ? value / 100 : value)));
  }, [reader.info?.tipPreferences]);
  const changeMode = (next: TipPreferences['mode']) => {
    setMode(next);
    setInputs(next === 'fixed' ? ['1', '2', '3', '4'] : ['10', '15', '20']);
    setMessage(null);
  };
  const parsed = inputs
    .filter((input) => input.trim() !== '')
    .map((input) =>
      mode === 'fixed'
        ? parseCurrencyAmountMinor(input, currency ?? '', locale)
        : /^\d+$/.test(input)
          ? Number(input)
          : null,
    );
  const valid =
    parsed.length > 0 &&
    parsed.length <= 6 &&
    new Set(parsed).size === parsed.length &&
    parsed.every((value) => value !== null && value > 0 && value <= (mode === 'fixed' ? 100_000 : 100)) &&
    (mode !== 'fixed' || currency !== null);
  const preferences: TipPreferences = {
    mode,
    values: valid ? parsed.filter((value): value is number => value !== null) : [],
    currency: mode === 'fixed' ? currency : null,
  };
  const save = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await updateTipPreferences(preferences);
      if (!response.success || !response.data) throw new Error('tip preferences refused');
      await reader.refetch();
      setMessage(t('tip_preferences.saved'));
    } catch (_error: unknown) {
      setMessage(t('tip_preferences.save_failed'));
    } finally {
      setBusy(false);
    }
  };
  return { mode, inputs, setInputs, changeMode, busy, message, currency, preferences, valid, reader, save };
}
