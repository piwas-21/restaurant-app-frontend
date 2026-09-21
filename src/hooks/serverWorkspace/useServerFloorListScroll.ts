'use client';

import { useEffect, useRef } from 'react';
import type { ServerFloorView } from './useServerFloorViewState';

const SCROLL_PERSIST_DELAY_MS = 120;

/** Restores list position and writes it at most once per short trailing interval. */
export function useServerFloorListScroll(
  view: ServerFloorView,
  scrollTop: number,
  setScrollTop: (scrollTop: number) => void,
) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);

  useEffect(() => {
    if (!listRef.current || view !== 'list') return;
    listRef.current.scrollTop = scrollTop;
  }, [scrollTop, view]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || view !== 'list') return;
    const onScroll = () => {
      pendingScrollTopRef.current = list.scrollTop;
      if (scrollTimerRef.current !== null) return;
      scrollTimerRef.current = window.setTimeout(() => {
        scrollTimerRef.current = null;
        setScrollTop(pendingScrollTopRef.current);
      }, SCROLL_PERSIST_DELAY_MS);
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      list.removeEventListener('scroll', onScroll);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [setScrollTop, view]);

  return listRef;
}
