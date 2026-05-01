'use client';

import { Dispatch, MouseEvent, RefObject, SetStateAction, useCallback, useState } from 'react';
import type { TableDto } from '@/types/reservation';

export interface UseTableDragAndDropOptions {
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  draggingTable: string | null;
  draggingEntrance: boolean;
  setDraggingTable: Dispatch<SetStateAction<string | null>>;
  setDraggingEntrance: Dispatch<SetStateAction<boolean>>;
  entrancePosition: { x: number; y: number };
  setEntrancePosition: Dispatch<SetStateAction<{ x: number; y: number }>>;
  saveEntrancePosition: (pos: { x: number; y: number }) => void;
  selectedTable: TableDto | null;
  setSelectedTable: Dispatch<SetStateAction<TableDto | null>>;
  setTables: Dispatch<SetStateAction<TableDto[]>>;
  /** Called on click-without-drag, with the table that was clicked. */
  onTableClick: (table: TableDto) => void;
}

/**
 * Mouse drag for tables and the canvas-level "entrance" marker. The
 * `hasDragged` ref distinguishes a click-only press (forwards to
 * `onTableClick`) from a real drag (suppresses the click). Co-ordinate
 * conversions go through canvas percentages so the layout scales with
 * the viewport.
 */
export function useTableDragAndDrop({
  canvasRef,
  canvasWidth,
  canvasHeight,
  draggingTable,
  draggingEntrance,
  setDraggingTable,
  setDraggingEntrance,
  entrancePosition,
  setEntrancePosition,
  saveEntrancePosition,
  selectedTable,
  setSelectedTable,
  setTables,
  onTableClick,
}: UseTableDragAndDropOptions) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const handleTableMouseDown = useCallback(
    (e: MouseEvent, table: TableDto) => {
      e.stopPropagation();
      setSelectedTable(table);
      setHasDragged(false);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const tableX = (((table.positionX / canvasWidth) * 100) / 100) * rect.width;
      const tableY = (((table.positionY / canvasHeight) * 100) / 100) * rect.height;

      setDragOffset({ x: e.clientX - rect.left - tableX, y: e.clientY - rect.top - tableY });
      setDraggingTable(table.id);
    },
    [canvasRef, canvasWidth, canvasHeight, setSelectedTable, setDraggingTable],
  );

  const handleEntranceMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const entranceX = (entrancePosition.x / 100) * rect.width;
      const entranceY = (entrancePosition.y / 100) * rect.height;
      setDragOffset({ x: e.clientX - rect.left - entranceX, y: e.clientY - rect.top - entranceY });
      setDraggingEntrance(true);
    },
    [canvasRef, entrancePosition, setDraggingEntrance],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();

      if (draggingTable) {
        setHasDragged(true);
        const x = e.clientX - rect.left - dragOffset.x;
        const y = e.clientY - rect.top - dragOffset.y;
        const pixelX = (((x / rect.width) * 100) / 100) * canvasWidth;
        const pixelY = (((y / rect.height) * 100) / 100) * canvasHeight;
        const clampedX = Math.max(0, Math.min(canvasWidth, pixelX));
        const clampedY = Math.max(0, Math.min(canvasHeight, pixelY));

        setTables((prev) =>
          prev.map((t) => (t.id === draggingTable ? { ...t, positionX: clampedX, positionY: clampedY } : t)),
        );
        setSelectedTable((prev) =>
          prev && prev.id === draggingTable ? { ...prev, positionX: clampedX, positionY: clampedY } : prev,
        );
      } else if (draggingEntrance) {
        const x = e.clientX - rect.left - dragOffset.x;
        const y = e.clientY - rect.top - dragOffset.y;
        const percentX = Math.max(0, Math.min(100, (x / rect.width) * 100));
        const percentY = Math.max(0, Math.min(100, (y / rect.height) * 100));
        setEntrancePosition({ x: percentX, y: percentY });
      }
    },
    [
      canvasRef,
      canvasWidth,
      canvasHeight,
      draggingTable,
      draggingEntrance,
      dragOffset,
      setTables,
      setSelectedTable,
      setEntrancePosition,
    ],
  );

  const handleMouseUp = useCallback(() => {
    if (draggingTable) {
      setDraggingTable(null);
      // Click-without-drag → open the actions popup.
      if (!hasDragged && selectedTable) onTableClick(selectedTable);
      setHasDragged(false);
    }
    if (draggingEntrance) {
      setDraggingEntrance(false);
      saveEntrancePosition(entrancePosition);
    }
  }, [
    draggingTable,
    draggingEntrance,
    hasDragged,
    selectedTable,
    entrancePosition,
    setDraggingTable,
    setDraggingEntrance,
    saveEntrancePosition,
    onTableClick,
  ]);

  return { handleTableMouseDown, handleEntranceMouseDown, handleMouseMove, handleMouseUp };
}
