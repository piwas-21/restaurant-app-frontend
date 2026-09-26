'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface EditorSectionNavState {
  readonly activeId: string;
  readonly goTo: (id: string) => void;
}

/** Explicit selection for the editor's section tabs. */
export function useEditorSectionNav(sectionIds: readonly string[]): EditorSectionNavState {
  const idsKey = sectionIds.join('|');
  const validIds = useMemo(() => new Set(idsKey ? idsKey.split('|') : []), [idsKey]);
  const firstId = sectionIds[0] ?? '';
  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');

  useEffect(() => {
    setActiveId((current) => (validIds.has(current) ? current : firstId));
  }, [idsKey, validIds, firstId]);

  const goTo = useCallback((id: string) => setActiveId(id), []);
  return { activeId, goTo };
}
