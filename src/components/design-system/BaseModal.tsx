'use client';

import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import styles from './BaseModal.module.css';

export type BaseModalSize = 'sm' | 'md' | 'lg';

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
}

/**
 * Standard modal overlay (CLAUDE.md frontend §5 rule 2). Provides:
 *  - Portal-rendered backdrop + dialog
 *  - role="dialog", aria-modal="true", aria-labelledby pointing at the title
 *  - ESC and backdrop-click dismissal (each opt-out-able)
 *  - X close button with translated aria-label
 *  - body-scroll lock while open
 *
 * Replaces the ad-hoc createPortal+overlay pattern that's been duplicated
 * across CustomizationModal, ZReportModal, AlertDialog-style components.
 * Migration to this primitive is gradual — see issue #16.
 *
 * **Known limitation (deferred):** no focus trap. Tab can escape the dialog
 * to background controls. Acceptable for the C1.5 onboarding modals (short,
 * action-oriented) but should be added before BaseModal hosts longer forms.
 * Tracked separately as a follow-up under issue #16.
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
}: BaseModalProps) {
  const { t } = useTranslation();
  // useId is SSR-safe and idiomatic; previous Math.random in useRef worked
  // but would have mismatched if the dialog were ever server-rendered.
  const titleId = `base-modal-title-${useId()}`;
  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC dismissal — listener is global because focus may not be in the modal
  // yet when the user smashes the key (e.g. mid-mount).
  useEffect(() => {
    if (!isOpen || disableEscapeClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, disableEscapeClose, onClose]);

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

  // Move initial focus into the dialog box on open for screen-reader and
  // keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  const handleBackdrop = () => {
    if (!disableBackdropClose) onClose();
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
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t('close', 'Close')}>
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
