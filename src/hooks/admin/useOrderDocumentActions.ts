'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderDto } from '@/types/order';
import { exportOrderToCSV } from '@/utils/exportUtils';
import { exportOrderToPDF } from '@/utils/pdfExportUtils';

/**
 * Getting an order OUT of the app — print, CSV, PDF — and the export menu's open state.
 *
 * Split from `useOrderDetailsActions`, which sat exactly at the 200-LOC hook limit, so the E9
 * error-handling work there had nowhere to go (#383). These three handlers were the obvious cut:
 * they share none of that hook's state, touch no API, and can therefore fail in none of the ways
 * the rest of it can. What is left there is the part that talks to the server.
 */
export function useOrderDocumentActions(order: OrderDto) {
  const { t } = useTranslation();
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handlePrint = () => {
    // Add print-specific class to body
    document.body.classList.add('printing');

    // Small delay to ensure styles are applied before print dialog opens
    setTimeout(() => {
      window.print();

      // Remove class after print dialog closes
      setTimeout(() => {
        document.body.classList.remove('printing');
      }, 100);
    }, 10);
  };

  const handleExport = () => {
    exportOrderToCSV(order, t);
    setShowExportMenu(false);
  };

  const handleExportPDF = () => {
    exportOrderToPDF(order, t);
    setShowExportMenu(false);
  };

  return { showExportMenu, setShowExportMenu, handlePrint, handleExport, handleExportPDF };
}

export default useOrderDocumentActions;
