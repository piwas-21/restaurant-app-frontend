'use client';

import { createContext, useContext, useEffect, useId, useRef, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import styles from './BaseModal.module.css';
import BaseModalSurface from './BaseModalSurface';

export type BaseModalSize = 'sm' | 'md' | 'lg';
export type BaseModalPresentation = 'modal' | 'responsive-sheet';

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Keep an explicit portal stack so only the nested top modal owns Escape and Tab.
const modalStack: HTMLDialogElement[] = [];
const ModalLayerContext = createContext(0);

function isTopMostModal(dialog: HTMLDialogElement | null): boolean {
  if (!dialog) return false;
  const dialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
  const top = dialogs.reduce<HTMLDialogElement | null>((current, candidate) => {
    const currentLayer = Number(current?.dataset.modalLayer ?? '-1');
    const candidateLayer = Number(candidate.dataset.modalLayer ?? '0');
    return candidateLayer >= currentLayer ? candidate : current;
  }, null);
  return (top ?? dialogs.at(-1) ?? modalStack.at(-1)) === dialog;
}

function focusableElements(dialog: HTMLDialogElement): HTMLElement[] {
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
  /** Keep the centered modal on wide screens and dock it to the bottom on narrow screens. */
  presentation?: BaseModalPresentation;
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

/** Shared portal modal with focus containment, nested ownership, pending protection and sheet presentation. */
export default function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  presentation = 'modal',
  className,
  disableBackdropClose,
  disableEscapeClose,
  isPending = false,
}: Readonly<BaseModalProps>) {
  const { t } = useTranslation();
  const modalLayer = useContext(ModalLayerContext);
  const titleId = `base-modal-title-${useId()}`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const canDismiss = !isPending;
  const layer = modalLayer + 1;
  const layerStyle = { '--modal-layer': layer } as CSSProperties;
  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (!isTopMostModal(dialogRef.current)) return;
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
      const last = elements.at(-1)!;
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
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    modalStack.push(dialog);
    const initial = dialog && focusableElements(dialog)[0];
    if (isTopMostModal(dialog)) (initial ?? dialog)?.focus();

    return () => {
      const stackIndex = modalStack.lastIndexOf(dialog);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      const returnFocus = returnFocusRef.current;
      if (returnFocus?.isConnected) returnFocus.focus();
      returnFocusRef.current = null;
    };
  }, [isOpen]);
  if (!isOpen || typeof document === 'undefined') return null;

  const handleBackdrop = () => {
    if (isTopMostModal(dialogRef.current) && canDismiss && !disableBackdropClose) onClose();
  };

  return (
    <ModalLayerContext.Provider value={layer}>
      {createPortal(
        <>
          <button
            type="button"
            className={[styles.overlay, presentation === 'responsive-sheet' && styles.responsiveSheetOverlay]
              .filter(Boolean)
              .join(' ')}
            style={layerStyle}
            onClick={handleBackdrop}
            aria-label={t('dismiss', 'Dismiss')}
            disabled={!canDismiss}
          />
          <BaseModalSurface
            dialogRef={dialogRef}
            titleId={titleId}
            title={title}
            footer={footer}
            size={size}
            presentation={presentation}
            layer={layer}
            className={className}
            isPending={!canDismiss}
            onClose={onClose}
          >
            {children}
          </BaseModalSurface>
        </>,
        document.body,
      )}
    </ModalLayerContext.Provider>
  );
}
