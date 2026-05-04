'use client';

import { useCallback, useState } from 'react';

/** Bulk-selection state for reservations: a Set of IDs + toggle/clear. */
export function useReservationsBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, toggleSelection, clearSelection };
}
