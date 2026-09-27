'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { useCataloguePreferences } from '@/hooks/admin/useCataloguePreferences';
import {
  cuisinePreferencesSchema,
  MAX_CUISINE_PREFERENCES,
  normalizeCuisinePreference,
} from './catalogueCuisinePreferenceSchema';
import styles from './CatalogueCuisinePreferences.module.css';

export default function CatalogueCuisinePreferences({
  onPreferencesLoaded,
}: {
  readonly onPreferencesLoaded: (cuisines: string[]) => void;
}) {
  const { t } = useTranslation();
  const preferences = useCataloguePreferences();
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState(false);
  const [pending, setPending] = useState<string[] | null>(null);
  const cuisines = pending ?? preferences.cuisines;

  useEffect(() => {
    onPreferencesLoaded(preferences.cuisines);
  }, [onPreferencesLoaded, preferences.cuisines]);

  const addCuisine = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = cuisinePreferencesSchema.safeParse([...cuisines, normalizeCuisinePreference(draft)]);
    if (!parsed.success) {
      setValidationError(true);
    } else {
      setPending(parsed.data);
      setValidationError(false);
    }
    setDraft('');
  };

  const removeCuisine = (removed: string) => {
    const parsed = cuisinePreferencesSchema.safeParse(cuisines.filter((cuisine) => cuisine !== removed));
    if (parsed.success) setPending(parsed.data);
    setValidationError(false);
  };

  const save = async () => {
    const parsed = cuisinePreferencesSchema.safeParse(cuisines);
    if (!parsed.success) {
      setValidationError(true);
      return;
    }
    if (await preferences.save(parsed.data)) {
      setPending(null);
      setValidationError(false);
      onPreferencesLoaded(parsed.data);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="catalogue-preferences-heading">
      <div className={styles.heading}>
        <div>
          <h2 id="catalogue-preferences-heading">{t('catalogue_preferences_title')}</h2>
          <p>{t('catalogue_preferences_intro')}</p>
        </div>
        <button type="button" onClick={() => void preferences.retry()} disabled={preferences.isLoading}>
          {t('catalogue_preferences_reload')}
        </button>
      </div>
      {preferences.error && (
        <p className={styles.error} role="alert">
          {t(preferences.error)}
        </p>
      )}
      <form className={styles.addForm} onSubmit={addCuisine}>
        <FormField label={t('catalogue_preferences_add_label')}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={preferences.isLoading || cuisines.length >= MAX_CUISINE_PREFERENCES}
            autoComplete="off"
          />
        </FormField>
        <button type="submit" disabled={!draft.trim() || cuisines.length >= MAX_CUISINE_PREFERENCES}>
          {t('catalogue_preferences_add')}
        </button>
      </form>
      {validationError && <p className={styles.error}>{t('catalogue_preferences_invalid')}</p>}
      <ul className={styles.tags} aria-label={t('catalogue_preferences_selected')}>
        {cuisines.map((cuisine) => (
          <li key={cuisine}>
            <span>{cuisine}</span>
            <button
              type="button"
              onClick={() => removeCuisine(cuisine)}
              aria-label={t('catalogue_preferences_remove', { cuisine })}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <span>{t('catalogue_preferences_limit', { count: cuisines.length, max: MAX_CUISINE_PREFERENCES })}</span>
        <button type="button" onClick={() => void save()} disabled={preferences.isSaving || pending === null}>
          {t(preferences.isSaving ? 'saving' : 'catalogue_preferences_save')}
        </button>
      </div>
    </section>
  );
}
