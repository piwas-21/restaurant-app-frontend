'use client';

import { RefObject, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardShortcut, useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export interface UseAdminOrdersKeyboardShortcutsOptions {
  searchInputRef: RefObject<HTMLInputElement | null>;
  refresh: () => void;
  closeAllModals: () => void;
  openShortcutsModal: () => void;
  /** Disable shortcuts while a non-shortcut modal is open. */
  disabled: boolean;
}

/**
 * Defines + activates the four keyboard shortcuts on the admin orders
 * page (refresh / focus search / close-modals / show-shortcuts) and
 * returns the shortcut list so the modal component can render help text.
 */
export function useAdminOrdersKeyboardShortcuts({
  searchInputRef,
  refresh,
  closeAllModals,
  openShortcutsModal,
  disabled,
}: UseAdminOrdersKeyboardShortcutsOptions): KeyboardShortcut[] {
  const { t } = useTranslation();

  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      {
        key: 'r',
        description: t('refresh_orders_list', 'Refresh orders list'),
        translationKey: 'refresh_orders_list',
        action: refresh,
      },
      {
        key: 'n',
        description: t('focus_search_input', 'Focus search input'),
        translationKey: 'focus_search_input',
        action: () => searchInputRef.current?.focus(),
      },
      {
        key: 'Escape',
        description: t('close_open_modals', 'Close open modals'),
        translationKey: 'close_open_modals',
        action: closeAllModals,
      },
      {
        key: '?',
        shift: true,
        description: t('show_keyboard_shortcuts', 'Show keyboard shortcuts'),
        translationKey: 'show_keyboard_shortcuts',
        action: openShortcutsModal,
      },
    ],
    [t, refresh, searchInputRef, closeAllModals, openShortcutsModal],
  );

  useKeyboardShortcuts({ shortcuts, enabled: !disabled });

  return shortcuts;
}
