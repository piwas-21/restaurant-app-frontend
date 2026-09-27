'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import { useCataloguePreferences } from '@/hooks/admin/useCataloguePreferences';
import styles from './CatalogueCuisinePreferences.module.css';

const MAX_PREFERENCES = 12;

function cuisineSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function CatalogueCuisinePreferences({
  onPreferencesLoaded,
}: {
  readonly onPreferencesLoaded: (cuisines: string[]) => void;
}) {
  const { t } = useTranslation();
  const preferences = useCataloguePreferences();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string[] | null>(null);
  const cuisines = pending ?? preferences.cuisines;

  useEffect(() => {
    onPreferencesLoaded(preferences.cuisines);
  }, [onPreferencesLoaded, preferences.cuisines]);

  const addCuisine = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = cuisineSlug(draft);
    if (next && !cuisines.includes(next) && cuisines.length < MAX_PREFERENCES) {
      setPending([...cuisines, next]);
    }
    setDraft('');
  };

  const removeCuisine = (removed: string) => setPending(cuisines.filter((cuisine) => cuisine !== removed));

  const save = async () => {
    if (await preferences.save(cuisines)) {
      setPending(null);
      onPreferencesLoaded(cuisines);
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
            disabled={preferences.isLoading || cuisines.length >= MAX_PREFERENCES}
            autoComplete="off"
          />
        </FormField>
        <button type="submit" disabled={!draft.trim() || cuisines.length >= MAX_PREFERENCES}>
          {t('catalogue_preferences_add')}
        </button>
      </form>
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
        <span>{t('catalogue_preferences_limit', { count: cuisines.length, max: MAX_PREFERENCES })}</span>
        <button type="button" onClick={() => void save()} disabled={preferences.isSaving || pending === null}>
          {t(preferences.isSaving ? 'saving' : 'catalogue_preferences_save')}
        </button>
      </div>
    </section>
  );
}
