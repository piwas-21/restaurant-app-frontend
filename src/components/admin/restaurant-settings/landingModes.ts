import type { TFunction } from 'i18next';
import type { LandingBackgroundMode } from '@/types/landingPage';

export interface ModeOption {
  value: LandingBackgroundMode;
  label: string;
  hint: string;
  disabled?: boolean;
}

/**
 * The three background modes, as the radio group renders them. Module scope so
 * LandingTab stays under the file-length gate; nothing here is per-instance.
 * `custom` is disabled — with the reason written as its hint — until the tenant
 * has an upload for it to select.
 */
export function buildModes(t: TFunction, hasUpload: boolean): ModeOption[] {
  return [
    {
      value: 'default',
      label: t('landing_mode_default', 'Platform background'),
      hint: t('landing_mode_default_hint', 'The neutral RUMI artwork the site ships with.'),
    },
    {
      value: 'custom',
      label: t('landing_mode_custom', 'My own photo'),
      hint: hasUpload
        ? t('landing_mode_custom_hint', 'Your upload, full-width behind the welcome text.')
        : t('landing_mode_custom_needs_upload', 'Upload a photo below to unlock this option.'),
      disabled: !hasUpload,
    },
    {
      value: 'none',
      label: t('landing_mode_none', 'No background image'),
      hint: t('landing_mode_none_hint', 'A plain colour block behind the welcome text.'),
    },
  ];
}
