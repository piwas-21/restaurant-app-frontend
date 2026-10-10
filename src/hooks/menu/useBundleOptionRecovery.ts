'use client';

import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';
import {
  hasUnresolvedBundleOptionSelections,
  removeUnresolvedBundleOptionSelections,
} from '@/utils/bundleOptionResolution';

export function useBundleOptionRecovery(
  sections: readonly MenuSection[],
  selections: readonly SelectedMenuOption[],
  setSelections: Dispatch<SetStateAction<SelectedMenuOption[]>>,
) {
  const hasUnresolvedOptions = useMemo(
    () => hasUnresolvedBundleOptionSelections(sections, selections),
    [sections, selections],
  );
  const clearUnresolvedOptions = useCallback(
    () => setSelections((previous) => removeUnresolvedBundleOptionSelections(sections, previous)),
    [sections, setSelections],
  );
  return { hasUnresolvedOptions, clearUnresolvedOptions };
}
