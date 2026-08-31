'use client';

import { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { invalidateLandingPageCache, useLandingPage } from '@/hooks/useLandingPage';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage } from '@/utils/apiFormErrors';
import { deleteInteriorImage, updateLandingPage, uploadInteriorImage } from '@/services/restaurantInfoService';
import type { LandingBackgroundMode, LandingPageContentDto } from '@/types/landingPage';
import InteriorImageSlot from './InteriorImageSlot';
import styles from './LandingTab.module.css';

/**
 * Everything the landing screen shows, in one tab: the background image (upload, remove, or
 * switch the mode) and the per-language copy overrides for the hero and the our-story section.
 *
 * The save is a FULL replace server-side — a locale row the payload omits is removed. So the
 * tab keeps every row it loaded, edits only the language on screen, and PUTs the whole set;
 * a row left entirely blank is dropped from the payload, which is the same as "no overrides
 * for that language".
 */
type Draft = {
  heroEyebrow: string;
  welcomeTitle: string;
  welcomeBody: string;
  storyTitle: string;
  storyBody: string;
};

const EDITABLE_LANGUAGES = ['en', 'tr', 'de', 'fr', 'nl', 'it', 'ar', 'es', 'ru', 'zh'] as const;

const EMPTY_DRAFT: Draft = { heroEyebrow: '', welcomeTitle: '', welcomeBody: '', storyTitle: '', storyBody: '' };

const draftFromContent = (content: LandingPageContentDto | undefined): Draft =>
  content
    ? {
        heroEyebrow: content.heroEyebrow ?? '',
        welcomeTitle: content.welcomeTitle ?? '',
        welcomeBody: content.welcomeBody ?? '',
        storyTitle: content.storyTitle ?? '',
        storyBody: content.storyBody ?? '',
      }
    : { ...EMPTY_DRAFT };

export default function LandingTab() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { info } = useRestaurantInfo();
  const { landing } = useLandingPage();

  const [mode, setMode] = useState<LandingBackgroundMode>('default');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  // Server state lands asynchronously; seed the form ONCE so a refetch never clobbers typing.
  const [seeded, setSeeded] = useState(false);
  const [busy, setBusy] = useState<'interior' | 'save' | null>(null);

  useEffect(() => {
    if (landing && !seeded) {
      setMode(landing.backgroundMode);
      setDrafts(Object.fromEntries(EDITABLE_LANGUAGES.map((code) => [code, draftFromContent(landing.content[code])])));
      setSeeded(true);
    }
  }, [landing, seeded]);

  const patch = (language: string, field: keyof Draft, value: string) =>
    setDrafts((current) => ({ ...current, [language]: { ...current[language], ...{ [field]: value } } }));

  const hasUpload = Boolean(info?.interiorImageUrl);

  const save = async () => {
    setBusy('save');
    try {
      const content = Object.entries(drafts)
        .map(([languageCode, draft]) => ({
          languageCode,
          heroEyebrow: draft.heroEyebrow.trim() || null,
          welcomeTitle: draft.welcomeTitle.trim() || null,
          welcomeBody: draft.welcomeBody.trim() || null,
          storyTitle: draft.storyTitle.trim() || null,
          storyBody: draft.storyBody.trim() || null,
        }))
        // An all-blank row stores five nulls, which is exactly "absent" — sending it would only
        // make the payload (and the diff on the server) lie about what the admin wrote.
        // `languageCode` does not count as content: it is every row's key, blank or not.
        .filter((row) =>
          [row.heroEyebrow, row.welcomeTitle, row.welcomeBody, row.storyTitle, row.storyBody].some(
            (value) => value !== null,
          ),
        );
      const response = await updateLandingPage({ backgroundMode: mode, content });
      if (response.success) {
        invalidateLandingPageCache();
        enqueueSnackbar(t('landing_save_success', 'Landing page saved'), { variant: 'success' });
      } else {
        enqueueSnackbar(serverMessage(response) ?? t('landing_save_failed', 'Failed to save the landing page'), {
          variant: 'error',
        });
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err) ?? t('landing_save_failed', 'Failed to save the landing page'), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const runImage = async (action: () => Promise<{ success: boolean; message?: string; errors?: unknown }>) => {
    setBusy('interior');
    try {
      const response = await action();
      if (response.success) {
        enqueueSnackbar(t('interior_photo_save_success', 'Background saved'), { variant: 'success' });
      } else {
        enqueueSnackbar(serverMessage(response) ?? t('interior_photo_save_failed', 'Failed to save the background'), {
          variant: 'error',
        });
      }
    } catch (err) {
      enqueueSnackbar(getErrorMessage(err) ?? t('interior_photo_save_failed', 'Failed to save the background'), {
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const MODES: Array<{ value: LandingBackgroundMode; label: string; hint: string; disabled?: boolean }> = [
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

  const draft = drafts[selectedLanguage] ?? EMPTY_DRAFT;
  const field = (key: keyof Draft, label: string, multiline = false) => (
    <div className={styles.field}>
      <label htmlFor={`landing-${selectedLanguage}-${key}`}>{label}</label>
      {multiline ? (
        <textarea
          id={`landing-${selectedLanguage}-${key}`}
          className={styles.input}
          rows={3}
          value={draft[key]}
          onChange={(event) => patch(selectedLanguage, key, event.target.value)}
        />
      ) : (
        <input
          id={`landing-${selectedLanguage}-${key}`}
          type="text"
          className={styles.input}
          value={draft[key]}
          onChange={(event) => patch(selectedLanguage, key, event.target.value)}
        />
      )}
    </div>
  );

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        {t(
          'landing_desc',
          'Everything on the landing screen: the background photo and the welcome and our-story texts. Without your own texts, visitors see the built-in ones in their language.',
        )}
      </p>

      <section aria-labelledby="landing-mode-heading" className={styles.section}>
        <h3 id="landing-mode-heading" className={styles.sectionTitle}>
          {t('landing_mode_title', 'Background image')}
        </h3>
        <div className={styles.modeGrid} role="radiogroup" aria-label={t('landing_mode_title', 'Background image')}>
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-label={option.label}
              aria-checked={mode === option.value}
              disabled={option.disabled}
              className={`${styles.modeOption} ${mode === option.value ? styles.modeActive : ''}`}
              onClick={() => setMode(option.value)}
            >
              <span className={styles.modeLabel}>{option.label}</span>
              <span className={styles.modeHint}>{option.hint}</span>
            </button>
          ))}
        </div>
        {info && (
          <InteriorImageSlot
            currentUrl={info.interiorImageUrl}
            restaurantName={info.name}
            isBusy={busy === 'interior'}
            onUpload={(file) => runImage(() => uploadInteriorImage(file))}
            onRemove={() => runImage(() => deleteInteriorImage())}
          />
        )}
      </section>

      <section aria-labelledby="landing-copy-heading" className={styles.section}>
        <h3 id="landing-copy-heading" className={styles.sectionTitle}>
          {t('landing_copy_title', 'Welcome and our-story texts')}
        </h3>
        <div className={styles.field}>
          <label htmlFor="landing-language">{t('landing_language', 'Language')}</label>
          <select
            id="landing-language"
            className={styles.input}
            value={selectedLanguage}
            onChange={(event) => setSelectedLanguage(event.target.value)}
          >
            {EDITABLE_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {t(`language_${code}`)}
              </option>
            ))}
          </select>
        </div>
        {field('welcomeTitle', t('landing_welcome_title', 'Welcome title'))}
        {field('welcomeBody', t('landing_welcome_body', 'Welcome text'), true)}
        {field('heroEyebrow', t('landing_hero_eyebrow', 'Small line above the title'))}
        {field('storyTitle', t('landing_story_title', 'Our-story heading'))}
        {field('storyBody', t('landing_story_body', 'Our-story text'), true)}
      </section>

      <div className={styles.actions}>
        <button type="button" onClick={save} disabled={busy !== null || !seeded}>
          {busy === 'save' ? t('saving', 'Saving...') : t('save', 'Save')}
        </button>
      </div>
    </div>
  );
}
