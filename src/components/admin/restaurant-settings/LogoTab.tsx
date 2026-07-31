'use client';

import { useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo, invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { uploadRestaurantLogo, deleteRestaurantLogo } from '@/services/restaurantInfoService';
import type { LogoVariant } from '@/types/restaurantInfo';
import LogoSlot from './LogoSlot';
import styles from './LogoTab.module.css';

/**
 * Upload the restaurant's own logo (SOFRA-ONBOARDING-PLAN O6).
 *
 * Separate from AppearanceTab, which owns the colour palette, because the checklist has a
 * separate `logo` step and a step that deep-links to a tab has to land on the thing it
 * names. Both write to `RestaurantInfo`, but through different endpoints on purpose: the
 * palette rides `PUT /api/restaurant-info`, which is a FULL upsert, so routing the logo
 * through it would mean every General Settings save could wipe the logo.
 */
export default function LogoTab() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { info, isLoading, refetch } = useRestaurantInfo();
  const [busy, setBusy] = useState<LogoVariant | null>(null);

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

  const run = async (variant: LogoVariant, action: () => Promise<{ success: boolean; message?: string }>) => {
    setBusy(variant);
    try {
      const response = await action();
      if (response.success) {
        invalidateRestaurantInfoCache();
        await refetch();
        enqueueSnackbar(t('logo_save_success', 'Logo saved'), { variant: 'success' });
      } else {
        // The backend reports a rejected file (wrong type, too large) as `success: false`
        // inside a 200, so `message` is the only place the reason exists.
        enqueueSnackbar(response.message ?? t('logo_save_failed', 'Failed to save the logo'), {
          variant: 'error',
        });
      }
    } catch {
      enqueueSnackbar(t('logo_save_failed', 'Failed to save the logo'), { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        {t(
          'logo_desc',
          'Upload your logo and it appears in your header straight away — no rebuild needed. With no logo, your restaurant name is shown as text instead.',
        )}
      </p>

      <div className={styles.slots}>
        <LogoSlot
          variant="light"
          title={t('logo_light_title', 'Logo')}
          hint={t('logo_light_hint', 'Shown on light backgrounds, and everywhere if you upload only one.')}
          currentUrl={info.logoUrl}
          restaurantName={info.name}
          isBusy={busy === 'light'}
          onUpload={(file) => run('light', () => uploadRestaurantLogo('light', file))}
          onRemove={() => run('light', () => deleteRestaurantLogo('light'))}
        />
        <LogoSlot
          variant="dark"
          title={t('logo_dark_title', 'Dark-theme logo')}
          hint={t('logo_dark_hint', 'Optional. Used in dark mode; without it your main logo is used there too.')}
          currentUrl={info.logoDarkUrl}
          restaurantName={info.name}
          isBusy={busy === 'dark'}
          onUpload={(file) => run('dark', () => uploadRestaurantLogo('dark', file))}
          onRemove={() => run('dark', () => deleteRestaurantLogo('dark'))}
        />
      </div>
    </div>
  );
}
