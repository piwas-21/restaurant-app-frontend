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
    } catch (featureError) {
      void featureError;
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
