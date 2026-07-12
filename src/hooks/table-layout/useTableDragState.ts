'use client';

import { useState } from 'react';

/**
 * Holds the transient drag flags shared between the table-layout
 * orchestrator and the drag/entrance mouse handlers: which table (if
 * any) is being dragged, whether the entrance marker is being dragged,
 * and the pointer-to-origin offset captured on mouse-down.
 */
export function useTableDragState() {
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [draggingEntrance, setDraggingEntrance] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  return {
    draggingTable,
    setDraggingTable,
    draggingEntrance,
    setDraggingEntrance,
    dragOffset,
    setDragOffset,
  };
}
