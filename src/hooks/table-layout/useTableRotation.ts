'use client';

import { Dispatch, MouseEvent, RefObject, SetStateAction, useCallback, useState } from 'react';
import type { TableDto } from '@/types/reservation';

const FULL_TURN_DEG = 360;
const RAD_TO_DEG = 180 / Math.PI;

export interface UseTableRotationOptions {
  canvasRef: RefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  tables: TableDto[];
  setTables: Dispatch<SetStateAction<TableDto[]>>;
  setSelectedTable: Dispatch<SetStateAction<TableDto | null>>;
  /** Persist the new rotation; called once at the end of a drag. */
  persistRotation: (table: TableDto) => Promise<void>;
}

/**
 * Wraps the rotation-handle drag: compute the angle from canvas centre
 * to mouse on each move, apply a starting offset so the handle doesn't
 * jump, normalise to 0-360, and persist on release.
 */
export function useTableRotation({
  canvasRef,
  canvasWidth,
  canvasHeight,
  tables,
  setTables,
  setSelectedTable,
  persistRotation,
}: UseTableRotationOptions) {
  const [rotatingTable, setRotatingTable] = useState<string | null>(null);
  const [startAngle, setStartAngle] = useState(0);

  // Centre of the table in canvas-rect pixels.
  const tableCentreInRect = useCallback(
    (table: TableDto, rect: DOMRect) => ({
      x: (((table.positionX / canvasWidth) * 100) / 100) * rect.width,
      y: (((table.positionY / canvasHeight) * 100) / 100) * rect.height,
    }),
    [canvasWidth, canvasHeight],
  );

  const handleRotationStart = useCallback(
    (tableId: string, e: MouseEvent) => {
      e.stopPropagation();
      const canvas = canvasRef.current;
      const table = tables.find((t) => t.id === tableId);
      if (!canvas || !table) return;

      const rect = canvas.getBoundingClientRect();
      const centre = tableCentreInRect(table, rect);
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mouseAngle = Math.atan2(mouseY - centre.y, mouseX - centre.x) * RAD_TO_DEG;

      setStartAngle((table.rotation || 0) - mouseAngle);
      setRotatingTable(tableId);
      setSelectedTable(table);
    },
    [canvasRef, tables, tableCentreInRect, setSelectedTable],
  );

  const handleRotationMove = useCallback(
    (e: MouseEvent) => {
      const canvas = canvasRef.current;
      const table = tables.find((t) => t.id === rotatingTable);
      if (!canvas || !table || !rotatingTable) return;

      const rect = canvas.getBoundingClientRect();
      const centre = tableCentreInRect(table, rect);
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const mouseAngle = Math.atan2(mouseY - centre.y, mouseX - centre.x) * RAD_TO_DEG;

      let newRotation = mouseAngle + startAngle;
      while (newRotation < 0) newRotation += FULL_TURN_DEG;
      while (newRotation >= FULL_TURN_DEG) newRotation -= FULL_TURN_DEG;

      const rounded = Math.round(newRotation);
      setTables((prev) => prev.map((t) => (t.id === rotatingTable ? { ...t, rotation: rounded } : t)));
      setSelectedTable((prev) => (prev && prev.id === rotatingTable ? { ...prev, rotation: rounded } : prev));
    },
    [canvasRef, tables, tableCentreInRect, rotatingTable, startAngle, setTables, setSelectedTable],
  );

  const handleRotationEnd = useCallback(async () => {
    if (!rotatingTable) return;
    const table = tables.find((t) => t.id === rotatingTable);
    if (table) await persistRotation(table);
    setRotatingTable(null);
    setStartAngle(0);
  }, [rotatingTable, tables, persistRotation]);

  return { rotatingTable, handleRotationStart, handleRotationMove, handleRotationEnd };
}
