'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { updateTipPreferences } from '@/services/tipPreferencesService';
import {
  MAX_TIP_PRESETS,
  parseTipPreferenceValues,
  tipPreferencesSchema,
  type TipPreferencesForm,
} from '@/components/admin/restaurant-settings/tipPreferencesSchema';
import type { TipPreferences } from '@/types/tipPreferences';

export function useTipPreferencesEditor() {
  const { t, i18n } = useTranslation();
  const reader = useRestaurantInfo();
  const [message, setMessage] = useState<string | null>(null);
  const locale = i18n.language || 'en';
  const currency = reader.info?.currency ?? null;
  const schema = useMemo(() => tipPreferencesSchema(locale), [locale]);
  const form = useForm<TipPreferencesForm>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { mode: 'percentage', inputs: ['10', '15', '20'], currency },
  });
  const { reset, setValue, getValues } = form;
  const mode = form.watch('mode');
  const inputs = form.watch('inputs');
  useEffect(() => {
    const preferences = reader.info?.tipPreferences;
    if (!preferences) {
      setValue('currency', currency);
      return;
    }
    reset({
      mode: preferences.mode,
      currency,
      inputs: preferences.values.map((value) => String(preferences.mode === 'fixed' ? value / 100 : value)),
    });
  }, [currency, reader.info?.tipPreferences, reset, setValue]);
  const changeMode = (next: TipPreferences['mode']) => {
    setValue('mode', next, { shouldValidate: true, shouldDirty: true });
    setValue('inputs', next === 'fixed' ? ['1', '2', '3', '4'] : ['10', '15', '20'], {
      shouldValidate: true,
      shouldDirty: true,
    });
    setMessage(null);
  };
  const setInputs = (update: (values: string[]) => string[]) => {
    const updated = update(getValues('inputs'));
    setValue(
      'inputs',
      Array.from({ length: MAX_TIP_PRESETS }, (_, index) => updated[index] ?? ''),
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
  };
  const parsed = schema.safeParse({ mode, inputs, currency });
  const valid = parsed.success;
  const preferences: TipPreferences = {
    mode,
    currency: mode === 'fixed' ? currency : null,
    values: parsed.success
      ? parseTipPreferenceValues(parsed.data, locale).filter((value): value is number => value !== null)
      : [],
  };
  const save = form.handleSubmit(async (data) => {
    setMessage(null);
    try {
      const response = await updateTipPreferences({
        mode: data.mode,
        values: parseTipPreferenceValues(data, locale).filter((value): value is number => value !== null),
        currency: data.mode === 'fixed' ? data.currency : null,
      });
      if (!response.success || !response.data) throw new Error('tip preferences refused');
      await reader.refetch();
      setMessage(t('tip_preferences.saved'));
    } catch (_error: unknown) {
      setMessage(t('tip_preferences.save_failed'));
    }
  });
  return {
    mode,
    inputs,
    setInputs,
    changeMode,
    busy: form.formState.isSubmitting,
    message,
    currency,
    preferences,
    valid,
    reader,
    save,
  };
}
