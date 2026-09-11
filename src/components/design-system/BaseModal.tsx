'use client';

import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import styles from './BaseModal.module.css';

export type BaseModalSize = 'sm' | 'md' | 'lg';

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function focusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

export interface BaseModalProps {
  /** Controls visibility. When false the modal is unmounted, not just hidden. */
  isOpen: boolean;
  /** Fired when the user dismisses via ESC, backdrop click, or X button. */
  onClose: () => void;
  /** Visible heading text — also serves as the accessible label via aria-labelledby. */
  title: string;
  /** Modal body. */
  children: ReactNode;
  /** Optional footer (e.g. action buttons). */
  footer?: ReactNode;
  /**
   * Optional preset width. `sm` ≈ 400px, `md` (default) ≈ 560px, `lg` ≈ 800px.
   * For finer control, use `className` to override `max-width` directly.
   */
  size?: BaseModalSize;
  /**
   * Extra className appended to the dialog box. Use for content-specific
   * width/padding overrides (e.g. a wider variant for the customization
   * modals). Avoid overriding positioning or backdrop.
   */
  className?: string;
  /** Disable backdrop-click-to-close. Default false. */
  disableBackdropClose?: boolean;
  /** Disable ESC-key-to-close. Default false. */
  disableEscapeClose?: boolean;
  /**
   * A mutation is in flight. Dismissal controls are disabled so a financial or form action
   * cannot be hidden while its result is still unknown. The caller still owns its pending UI.
   */
  isPending?: boolean;
}

/**
 * Standard modal overlay (CLAUDE.md frontend §5 rule 2). Provides:
 *  - Portal-rendered backdrop + dialog
 *  - role="dialog", aria-modal="true", aria-labelledby pointing at the title
 *  - ESC and backdrop-click dismissal (each opt-out-able)
 *  - X close button with translated aria-label
 *  - body-scroll lock, initial focus, focus containment and return focus
 *  - dismissal protection while a caller-owned action is pending
 *
 * Replaces the ad-hoc createPortal+overlay pattern that's been duplicated
 * across CustomizationModal, ZReportModal, AlertDialog-style components.
 * Migration to this primitive is gradual — see issue #16.
 */
export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  className,
  disableBackdropClose,
  disableEscapeClose,
  isPending = false,
}: BaseModalProps) {
  const { t } = useTranslation();
  // useId is SSR-safe and idiomatic; previous Math.random in useRef worked
  // but would have mismatched if the dialog were ever server-rendered.
  const titleId = `base-modal-title-${useId()}`;
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canDismiss = !isPending;

  // ESC dismissal and Tab containment are global because focus can briefly be outside the
  // dialog during mount. Containment makes the portal a true modal for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canDismiss && !disableEscapeClose) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const elements = focusableElements(dialog);
      if (elements.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canDismiss, disableEscapeClose, isOpen, onClose]);

  // Lock body scroll while open. Restore the previous overflow value on
  // close so that a host page with its own overflow rules isn't stomped on.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Capture the invoking control before moving focus into the dialog. On close, restoring it
  // keeps a keyboard user in the same task context instead of dropping them at document start.
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const initial = dialog && focusableElements(dialog)[0];
    (initial ?? dialog)?.focus();

    return () => {
      const returnFocus = returnFocusRef.current;
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleBackdrop = () => {
    if (canDismiss && !disableBackdropClose) onClose();
  };

  return createPortal(
    <div className={styles.overlay} onClick={handleBackdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[styles.dialog, styles[`size_${size}`], className].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          {/* `auto`, not inherited: a modal title may be product-authored (the customization
              sheet passes the item name). For a locale string it is inert — an Arabic UI string
              resolves rtl either way. DESIGN-SYSTEM.md §8.2. */}
          <h2 id={titleId} dir="auto" className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('close', 'Close')}
            disabled={!canDismiss}
          >
            <X size={20} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
