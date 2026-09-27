'use client';

import { useCallback, useEffect, useState } from 'react';
import { getOptionSetMaterializationEnabled } from '@/services/optionSetService';

export function useOptionSetMaterializationFeature() {
  const [enabled, setEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(false);
    try {
      setEnabled(await getOptionSetMaterializationEnabled());
    } catch (_featureError) {
      /* Intentionally show the feature's generic failure state instead of leaking transport details here. */
      setEnabled(false);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { enabled, isLoading, error, reload };
}
