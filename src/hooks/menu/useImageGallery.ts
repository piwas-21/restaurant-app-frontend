'use client';

import { useCallback, useState } from 'react';

/**
 * Open/index state for the menu image lightbox (`MenuCardImage`). Restores the
 * enlarge-on-click gallery removed in f3f1269. `count` is the number of images;
 * `next`/`prev` wrap. `BaseModal` owns ESC + backdrop close; this owns the index.
 */
export function useImageGallery(count: number) {
  const [isOpen, setIsOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const open = useCallback(
    (startIndex = 0) => {
      setIndex(count > 0 && startIndex >= 0 && startIndex < count ? startIndex : 0);
      setIsOpen(true);
    },
    [count],
  );

  const close = useCallback(() => setIsOpen(false), []);
  const next = useCallback(() => setIndex((i) => (count > 0 ? (i + 1) % count : 0)), [count]);
  const prev = useCallback(() => setIndex((i) => (count > 0 ? (i - 1 + count) % count : 0)), [count]);

  return { isOpen, index, open, close, next, prev };
}
