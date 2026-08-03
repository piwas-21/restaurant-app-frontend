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

const EMPTY_TABLE_CONTEXT: TableContextData = {
  tableId: null,
  tableNumber: null,
  qrScanned: false,
  isOutdoor: false,
  dineInPinned: false,
};

export function TableContextProvider({ children }: { children: ReactNode }) {
  const [tableContext, setTableContextState] = useState<TableContextData>(EMPTY_TABLE_CONTEXT);

  // Load from session storage on mount.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        // Merged over the defaults, and only when it is an object. It used to be
        // `setTableContextState(parsed)` — which trusts whatever `JSON.parse` returns. Two ways
        // that bites, and the catch above sees neither, because neither one throws:
        //   - `JSON.parse('null')` is `null`, and the state then IS null, so
        //     `Boolean(tableContext.tableId)` below throws during render and takes the tree out.
        //   - a value written by an older shape replaces the state wholesale instead of filling
        //     the gaps, so a field this version added arrives `undefined` where a boolean is typed.
        // Neither is reachable from our own writer today (it only stores a full object, and only
        // when `tableId` is set) — but sessionStorage is not ours alone, and a guard that costs one
        // spread should not depend on that staying true.
        if (typeof parsed === 'object' && parsed !== null) {
          setTableContextState({ ...EMPTY_TABLE_CONTEXT, ...(parsed as Partial<TableContextData>) });
        }
      }
    } catch {
      // IGNORED ON PURPOSE — and the reason is that there is nothing to report and nothing lost.
      // This reads a QR scan back after a reload; the throws are `sessionStorage` being unavailable
      // (Safari private browsing, storage disabled) and `JSON.parse` on a corrupt value. In both
      // cases the correct state is the default above — "no table scanned" — which is exactly what
      // a guest who arrived without scanning gets, and the flow to recover is the one they would
      // take anyway: scan the code again. A toast here would report a failure the guest did not
      // cause, cannot fix, and does not need to know about.
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
