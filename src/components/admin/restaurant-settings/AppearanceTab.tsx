'use client';

import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo, invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { updateRestaurantInfo } from '@/services/restaurantInfoService';
import { PALETTES } from '@/design-system/palettes';
import { revalidateTenantTheme } from '@/app/actions/revalidateTenantTheme';
import { toUpdateCommand } from './appearanceCommand';
import styles from './AppearanceTab.module.css';

// English fallbacks so the picker is usable even before a locale ships the key
// (the i18n-parity gate guarantees they exist; this mirrors the codebase's
// `t('key', 'Fallback')` convention). Palette names stay English across locales.
const LABEL: Record<string, string> = {
  appearance_palette_default: 'Default (template)',
  palette_terracotta: 'Terracotta',
  palette_olive_grove: 'Olive Grove',
  palette_saffron: 'Saffron',
  palette_aubergine: 'Aubergine',
  palette_rose_clay: 'Rose Clay',
};

export default function AppearanceTab() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { info, isLoading, refetch } = useRestaurantInfo();
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (info) setSelected(info.themePaletteKey ?? null);
  }, [info]);

  if (isLoading && !info) {
    return <p>{t('loading', 'Loading...')}</p>;
  }
  if (!info) {
    return (
      <div className={styles.errorBanner} role="alert">
        <span>{t('general_settings_load_failed', 'Failed to load restaurant info')}</span>
        <button type="button" onClick={refetch}>
          {t('retry', 'Retry')}
        </button>
      </div>
    );
  }

  const current = info.themePaletteKey ?? null;
  const isDirty = selected !== current;

  const save = async () => {
    setIsSaving(true);
    try {
      const response = await updateRestaurantInfo(toUpdateCommand(info, selected));
      if (response.success) {
        invalidateRestaurantInfoCache();
        // Bust the SSR palette cache so a reload reflects the new palette
        // immediately, not after the 30s ISR window.
        await revalidateTenantTheme();
        await refetch();
        enqueueSnackbar(t('appearance_save_success', 'Palette saved — reload the site to see it'), {
          variant: 'success',
        });
      } else {
        enqueueSnackbar(response.message ?? t('general_settings_save_failed', 'Failed to save'), {
          variant: 'error',
        });
      }
    } catch {
      enqueueSnackbar(t('general_settings_save_failed', 'Failed to save'), { variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const options: Array<{ key: string | null; labelKey: string; swatch: string | null }> = [
    { key: null, labelKey: 'appearance_palette_default', swatch: null },
    ...PALETTES.map((p) => ({ key: p.key, labelKey: p.labelKey, swatch: p.swatch })),
  ];

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        {t(
          'appearance_desc',
          'Choose a colour palette for your public site. Changes apply on the next page load — no rebuild needed.',
        )}
      </p>
      <div className={styles.grid} role="radiogroup" aria-label={t('appearance_title', 'Colour palette')}>
        {options.map((opt) => {
          const active = selected === opt.key;
          return (
            <button
              key={opt.key ?? 'default'}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.option} ${active ? styles.active : ''}`}
              onClick={() => setSelected(opt.key)}
            >
              <span
                className={styles.swatch}
                // Dynamically computed colour (data-driven) — the §5/§6 exception.
                style={opt.swatch ? { backgroundColor: opt.swatch } : undefined}
                aria-hidden="true"
              >
                {opt.swatch ? '' : '—'}
              </span>
              <span className={styles.optionLabel}>{t(opt.labelKey, LABEL[opt.labelKey])}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={save} disabled={isSaving || !isDirty}>
          {isSaving ? t('saving', 'Saving...') : t('save', 'Save')}
        </button>
      </div>
    </div>
  );
}
