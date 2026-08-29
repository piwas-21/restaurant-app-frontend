'use client';

import { useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo, invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import {
  uploadRestaurantLogo,
  deleteRestaurantLogo,
  uploadInteriorImage,
  deleteInteriorImage,
} from '@/services/restaurantInfoService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import type { LogoVariant } from '@/types/restaurantInfo';
import LogoSlot from './LogoSlot';
import InteriorImageSlot from './InteriorImageSlot';
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
  // 'interior' rides the same busy state as the two logo slots: one tab, one in-flight
  // upload at a time, so the widened union is all this needed.
  const [busy, setBusy] = useState<LogoVariant | 'interior' | null>(null);

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

  const run = async (
    variant: LogoVariant | 'interior',
    action: () => Promise<{ success: boolean; message?: string; errors?: unknown }>,
    copy: { success: string; failure: string } = {
      success: t('logo_save_success', 'Logo saved'),
      failure: t('logo_save_failed', 'Failed to save the logo'),
    },
  ) => {
    setBusy(variant);
    try {
      const response = await action();
      if (response.success) {
        invalidateRestaurantInfoCache();
        await refetch();
        enqueueSnackbar(copy.success, { variant: 'success' });
      } else {
        // Reachable on the UPLOAD leg only. `run` wraps both `uploadRestaurantLogo` and
        // `deleteRestaurantLogo`, and `DeleteRestaurantLogoCommand` builds no `Failure` at all —
        // it throws `NotFoundException`, so a delete failure lands in the `catch` below.
        //
        // On upload, a rejected file (wrong type, too large) comes back `success: false` inside a
        // 200: `UpdateRestaurantLogoCommand` is a bare `return Ok(result)` and both failures it
        // builds — the file rejection and "Failed to upload logo" — leave the message argument
        // defaulted.
        //
        // That form puts the reason in `Errors[0]` and leaves `Message` at its default, the literal
        // `"Operation failed"` (`ApiResponse.cs:55-63`). The comment here used to say `message` was
        // "the only place the reason exists" and read it directly — so an admin uploading an
        // oversized file was told "Operation failed" while the real sentence sat unread in
        // `errors[0]`: "File size exceeds maximum allowed size of 10MB", the limit interpolated
        // from `FileStorageSettings.MaxFileSizeBytes` (bound to 10485760 in `appsettings.json`,
        // NOT the 5MB C# default). `serverMessage` reads `errors[]` first for exactly this reason.
        enqueueSnackbar(serverMessage(response) ?? copy.failure, {
          variant: 'error',
        });
      }
    } catch (err) {
      // Snackbar, not a panel — `getErrorMessage` rather than `useApiError`, which holds state a
      // fire-and-forget toast has nowhere to put. This arm is the transport failures (a dead
      // network, a 401, the `NotFoundException` when restaurant info was never initialised);
      // the file rejections resolve and land in the `else` above.
      enqueueSnackbar(getErrorMessage(err) ?? copy.failure, { variant: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const photoCopy = {
    success: t('interior_photo_save_success', 'Photo saved'),
    failure: t('interior_photo_save_failed', 'Failed to save the photo'),
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
        <InteriorImageSlot
          currentUrl={info.interiorImageUrl}
          restaurantName={info.name}
          isBusy={busy === 'interior'}
          onUpload={(file) => run('interior', () => uploadInteriorImage(file), photoCopy)}
          onRemove={() => run('interior', () => deleteInteriorImage(), photoCopy)}
        />
      </div>
    </div>
  );
}
