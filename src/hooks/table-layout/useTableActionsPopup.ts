'use client';

import { useCallback, useState } from 'react';
import type { TableDto } from '@/types/reservation';

const POPUP_PIXEL_OFFSET_X = 15;
const POPUP_PIXEL_OFFSET_Y = 15;

export interface UseTableActionsPopupOptions {
  canvasWidth: number;
  canvasHeight: number;
  /** Open the table-properties modal for the selected table. */
  openPropertiesModal: () => void;
  /** Open the QR-code modal for `table`. */
  openQRModal: (table: TableDto) => void;
  /** Open the delete-confirm modal for the selected table. */
  openDeleteModal: () => void;
}

/**
 * Owns the position + visibility of the per-table actions popup, and
 * the click handlers that route to the three downstream modals (edit
 * properties / view QR / delete).
 */
export function useTableActionsPopup({
  canvasWidth,
  canvasHeight,
  openPropertiesModal,
  openQRModal,
  openDeleteModal,
}: UseTableActionsPopupOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [target, setTarget] = useState<TableDto | null>(null);

  const openForTable = useCallback(
    (table: TableDto) => {
      setTarget(table);
      // Position is a percentage of the canvas (table position is in canvas pixels).
      setPosition({
        x: ((table.positionX + POPUP_PIXEL_OFFSET_X) / canvasWidth) * 100,
        y: ((table.positionY + POPUP_PIXEL_OFFSET_Y) / canvasHeight) * 100,
      });
      setIsOpen(true);
    },
    [canvasWidth, canvasHeight],
  );

  const close = useCallback(() => setIsOpen(false), []);

  const handleEdit = useCallback(() => {
    setIsOpen(false);
    openPropertiesModal();
  }, [openPropertiesModal]);

  const handleViewQR = useCallback(() => {
    if (!target) return;
    setIsOpen(false);
    openQRModal(target);
  }, [target, openQRModal]);

  const handleDelete = useCallback(() => {
    if (!target) return;
    setIsOpen(false);
    openDeleteModal();
  }, [target, openDeleteModal]);

  return { isOpen, position, target, openForTable, close, handleEdit, handleViewQR, handleDelete };
}
