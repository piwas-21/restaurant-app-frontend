'use client';

import { useEffect, useState } from 'react';
import { AutoPrintSettings, DEFAULT_AUTO_PRINT_SETTINGS } from '@/types/cashier';

const STORAGE_KEY = 'cashier_auto_print_settings';

export interface UseCashierAutoPrintReturn {
  settings: AutoPrintSettings;
  saveSettings: (next: AutoPrintSettings) => void;
}

/**
 * Loads + persists the cashier auto-print settings in localStorage.
 * Decoupled from the page so other surfaces can read the same toggles.
 */
export function useCashierAutoPrint(): UseCashierAutoPrintReturn {
  const [settings, setSettings] = useState<AutoPrintSettings>(DEFAULT_AUTO_PRINT_SETTINGS);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      setSettings(JSON.parse(saved) as AutoPrintSettings);
    } catch (e) {
      console.error('Failed to parse auto-print settings:', e);
    }
  }, []);

  const saveSettings = (next: AutoPrintSettings) => {
    setSettings(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return { settings, saveSettings };
}
