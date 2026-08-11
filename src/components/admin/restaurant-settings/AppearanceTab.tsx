'use client';

import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo, invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { updateRestaurantInfo } from '@/services/restaurantInfoService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
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
        // Bust the SSR palette cache so a reload reflects the new palette immediately, not after
        // the 30s ISR window.
        //
        // Guarded SEPARATELY, and the guard is the point: this is a server action, so it is a
        // second round trip that can reject on its own — and the palette is already saved by the
        // time it runs. Left inside the outer `try` it would fall to the catch below and toast
        // "Failed to save" for a save that succeeded, which is the same class of lie as the
        // "Operation failed" wrapper this slice removed, just pointing the other way. A stale SSR
        // cache is not a failed save; it costs the admin one hard reload, so it is reported as its
        // own weaker sentence. (`refetch` needs no such guard — `useRestaurantInfo.fetchIfStale`
        // catches internally and cannot reject.)
        let themeRevalidated = true;
        try {
          await revalidateTenantTheme();
        } catch {
          // IGNORED ON PURPOSE as a failure — downgraded to a warning below rather than swallowed.
          themeRevalidated = false;
        }
        await refetch();
        enqueueSnackbar(
          themeRevalidated
            ? t('appearance_save_success', 'Palette saved — reload the site to see it')
            : t('appearance_saved_cache_stale', 'Palette saved, but the site cache did not refresh — reload to see it'),
          { variant: themeRevalidated ? 'success' : 'warning' },
        );
      } else {
        // Defensive, not the live path: `UpdateRestaurantInfoCommand` builds no `Failure` at all —
        // it throws (`NotFoundException`), so a refusal arrives as a non-2xx in the `catch` below.
        // Read `errors[]` first anyway, because if this branch ever does fire it will be through
        // the one-argument `ApiResponse.Failure(reason)`, whose `message` is the literal
        // "Operation failed" and whose reason is in `errors[0]`.
        enqueueSnackbar(serverMessage(response) ?? t('general_settings_save_failed', 'Failed to save'), {
          variant: 'error',
        });
      }
    } catch (err) {
      // Snackbar, not a panel — `getErrorMessage`, not `useApiError` (which holds state a
      // fire-and-forget toast has nowhere to put). This is the arm the update's own failures reach;
      // the post-save revalidation is guarded above so it cannot be reported as a failed save.
      enqueueSnackbar(getErrorMessage(err) ?? t('general_settings_save_failed', 'Failed to save'), {
        variant: 'error',
      });
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
