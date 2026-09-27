'use client';

import { useEffect, useState } from 'react';
import { getOptionSetProductVariations, type OptionSetProductVariation } from '@/services/optionSetReferenceService';

export function useOptionSetProductVariations(productId?: string) {
  const [variations, setVariations] = useState<OptionSetProductVariation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!productId) {
      setVariations([]);
      setIsLoading(false);
      setError(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(false);
    void getOptionSetProductVariations(productId, controller.signal)
      .then(setVariations)
      .catch(() => {
        if (!controller.signal.aborted) {
          setVariations([]);
          setError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [productId]);

  return { variations, isLoading, error };
}
