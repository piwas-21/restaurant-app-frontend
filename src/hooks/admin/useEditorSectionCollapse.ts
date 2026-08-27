'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Which editor sections the admin has collapsed, remembered between visits
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN D1, slice S2).
 *
 * D1 is "always-visible named sections, which the user MAY collapse, and the choice is remembered
 * per user". There is no per-user preference endpoint on the backend, so "per user" is the same
 * store the guest app already uses for a remembered choice: this browser profile's `localStorage`,
 * which is per signed-in workstation. A shared browser would share the preference; nothing in it
 * is private, and the alternative is a backend project for a chevron.
 *
 * Two shapes are deliberate:
 *
 * 1. **The stored value is the list of COLLAPSED ids, not a map.** A section that does not exist
 *    yet (a future slice's) therefore keeps its own default instead of inheriting a stale `false`,
 *    and an id that no longer exists is dropped on the next write rather than resurrecting.
 * 2. **Hydration happens in an effect, never during render.** The first paint has to match the
 *    server's, so the seed is the caller's defaults and the remembered state is applied after
 *    mount. Reading `localStorage` in a `useState` initialiser is the classic hydration mismatch.
 */
const STORAGE_KEY = 'sofra.admin.editor.collapsedSections';

interface CollapsibleSection {
  readonly id: string;
  readonly collapsible?: boolean;
  readonly defaultCollapsed?: boolean;
}

interface EditorSectionCollapseState {
  readonly isCollapsed: (id: string) => boolean;
  readonly toggle: (id: string) => void;
}

const readStored = (): string[] | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
  } catch (err) {
    // A blocked or full storage (private mode, an admin locking the browser down) may cost the
    // preference and nothing else — the caller's defaults stay in place and the editor opens. The
    // error is LOGGED rather than swallowed: there is no user-facing message worth showing for a
    // remembered chevron, but a console line is what tells the next debugger the storage is dead
    // rather than the hook being wrong. Same shape as `lib/orderTypeStorage.ts`.
    console.warn('useEditorSectionCollapse: could not read the remembered fold', err);
    return null;
  }
};

export function useEditorSectionCollapse(sections: readonly CollapsibleSection[]): EditorSectionCollapseState {
  // The seed, and the seed only: the caller hands over a fresh array literal on every render, so
  // this may never become a dependency that re-seeds. Once the component is mounted the admin's
  // own choice owns the list, and re-applying the defaults would re-collapse what they just opened.
  const [collapsedIds, setCollapsedIds] = useState<readonly string[]>(() =>
    sections.filter((section) => section.collapsible && section.defaultCollapsed).map((section) => section.id),
  );

  useEffect(() => {
    const stored = readStored();
    if (stored) setCollapsedIds(stored);
  }, []);

  const toggle = useCallback((id: string) => {
    setCollapsedIds((current) => {
      const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (err) {
        // Same trade as the read: the section still opens and closes, it is just not remembered.
        console.warn('useEditorSectionCollapse: could not remember the fold', err);
      }
      return next;
    });
  }, []);

  const isCollapsed = useCallback((id: string) => collapsedIds.includes(id), [collapsedIds]);

  return { isCollapsed, toggle };
}

export const COLLAPSED_SECTIONS_STORAGE_KEY = STORAGE_KEY;
