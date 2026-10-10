'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CustomerStepManifest } from '@/types/menu';

/** Keeps the customer-step manifest as a save-aware draft alongside the form's own state. */
export function useCustomerStepManifestDraft(productId: string, persisted: CustomerStepManifest | null | undefined) {
  const [manifest, setManifest] = useState<CustomerStepManifest | null>(persisted ?? null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setManifest(persisted ?? null);
    setIsDirty(false);
  }, [productId, persisted]);

  const change = useCallback(
    (next: CustomerStepManifest | null) => {
      setManifest(next);
      setIsDirty(JSON.stringify(next) !== JSON.stringify(persisted ?? null));
    },
    [persisted],
  );

  return { manifest, isDirty, change };
}
