'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Section-nav state for the admin item editor (MENU-ITEM-EDITOR-REDESIGN-PLAN S1).
 *
 * The redesign replaced the duplicate header Save with a sticky nav (decision D4): the reason a
 * second Save existed at all was that the page is too long to scroll, so the nav has to actually
 * take you somewhere AND tell you where you are.
 *
 * Two behaviours, both deliberate:
 *
 * 1. `goTo` sets the active id itself instead of waiting for the observer. A smooth scroll walks
 *    the observer through every section in between, so a click would otherwise light up three
 *    entries on the way to the fourth. Observer reports are ignored for {@link PIN_MS} after a
 *    click for the same reason.
 * 2. It focuses the target section (which carries `tabIndex={-1}`), so a keyboard user's next Tab
 *    continues INSIDE the section they just jumped to rather than from the nav.
 *
 * `IntersectionObserver` is absent in jsdom and in any non-browser render, so its absence is a
 * supported state: the nav still scrolls, it just stops tracking. Tests inject their own.
 */
const PIN_MS = 700;

/**
 * `rootMargin` picks "the section the reader is looking at", not "the first pixel on screen":
 * the top inset clears the sticky header/tab chrome, and the bottom inset stops a section that
 * has only just crept into the viewport floor from stealing the highlight from the one filling it.
 */
const OBSERVER_MARGIN = '-120px 0px -55% 0px';

interface EditorSectionNavState {
  readonly activeId: string;
  readonly goTo: (id: string) => void;
}

export function useEditorSectionNav(sectionIds: readonly string[], enabled = true): EditorSectionNavState {
  // Joined, so the effect re-runs when the SET of sections changes (an item gains its gallery once
  // saved) but not on every render, where the caller hands over a fresh array literal.
  const idsKey = useMemo(() => sectionIds.join('|'), [sectionIds]);
  const orderRef = useRef<readonly string[]>(sectionIds);
  orderRef.current = sectionIds;

  const [activeId, setActiveId] = useState<string>(sectionIds[0] ?? '');
  const pinnedUntilRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        if (Date.now() < pinnedUntilRef.current) return;
        const topMost = orderRef.current.find((id) => visible.has(id));
        if (topMost) setActiveId(topMost);
      },
      { rootMargin: OBSERVER_MARGIN, threshold: 0 },
    );

    for (const id of orderRef.current) {
      const node = document.getElementById(id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [idsKey, enabled]);

  // Keep the highlight on a real section when the list shrinks (switching kind, or a section that
  // only exists once the product is saved), instead of pointing at an id nothing renders.
  useEffect(() => {
    setActiveId((current) => (orderRef.current.includes(current) ? current : (orderRef.current[0] ?? '')));
  }, [idsKey]);

  const goTo = useCallback((id: string) => {
    pinnedUntilRef.current = Date.now() + PIN_MS;
    setActiveId(id);
    const node = document.getElementById(id);
    if (!node) return;
    // jsdom implements neither, and a missing scroll must not break the focus move that follows.
    if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.focus({ preventScroll: true });
  }, []);

  return { activeId, goTo };
}
