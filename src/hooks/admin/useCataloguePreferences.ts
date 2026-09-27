'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCataloguePreferences, putCataloguePreferences } from '@/services/catalogueImportService';
import { getErrorMessage } from '@/utils/apiClient';

const normalize = (cuisines: readonly string[]): string[] =>
  [...new Set(cuisines.map((cuisine) => cuisine.trim().toLowerCase()).filter(Boolean))].slice(0, 12);

export function useCataloguePreferences() {
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const preferences = await getCataloguePreferences();
      setCuisines(normalize(preferences.cuisines));
      setError(null);
    } catch (loadError) {
      setError(getErrorMessage(loadError) ?? 'catalogue_preferences_error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (next: readonly string[]) => {
    setIsSaving(true);
    try {
      const preferences = await putCataloguePreferences(normalize(next));
      setCuisines(normalize(preferences.cuisines));
      setError(null);
      return true;
    } catch (saveError) {
      setError(getErrorMessage(saveError) ?? 'catalogue_preferences_error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { cuisines, isLoading, isSaving, error, save, retry: load };
}
