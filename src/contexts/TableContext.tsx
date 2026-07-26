'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TableContextData {
  tableId: string | null;
  tableNumber: string | null;
  qrScanned: boolean;
  isOutdoor: boolean;
  /**
   * True once this scan has pinned the order type to Dine-In (gap G1).
   *
   * Lives HERE, in sessionStorage alongside the scan, rather than in a `useRef` inside the hook
   * that does the pinning: that hook is mounted per route (/menu, /cart, /checkout/review), so a
   * ref resets on every navigation and would re-pin Dine-In — silently undoing a guest who had
   * deliberately switched to Takeaway, on the very page that computes tax from the choice.
   */
  dineInPinned?: boolean;
}

interface TableContextType {
  tableContext: TableContextData;
  setTableContext: (data: Partial<TableContextData>) => void;
  clearTableContext: () => void;
  hasTableContext: boolean;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

const STORAGE_KEY = 'rumi_table_context';

export function TableContextProvider({ children }: { children: ReactNode }) {
  const [tableContext, setTableContextState] = useState<TableContextData>({
    tableId: null,
    tableNumber: null,
    qrScanned: false,
    isOutdoor: false,
    dineInPinned: false,
  });

  // Load from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setTableContextState(parsed);
      }
    } catch {
      // Invalid storage data, ignore
    }
  }, []);

  // Save to session storage whenever context changes
  useEffect(() => {
    if (tableContext.tableId) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tableContext));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [tableContext]);

  const setTableContext = (data: Partial<TableContextData>) => {
    setTableContextState((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const clearTableContext = () => {
    setTableContextState({
      tableId: null,
      tableNumber: null,
      qrScanned: false,
      isOutdoor: false,
      dineInPinned: false,
    });
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const hasTableContext = Boolean(tableContext.tableId);

  return (
    <TableContext.Provider
      value={{
        tableContext,
        setTableContext,
        clearTableContext,
        hasTableContext,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTableContext() {
  const context = useContext(TableContext);
  if (context === undefined) {
    throw new Error('useTableContext must be used within a TableContextProvider');
  }
  return context;
}
