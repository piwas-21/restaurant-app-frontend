import type { CSSProperties, ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { BaseModalPresentation, BaseModalSize } from './BaseModal';
import styles from './BaseModal.module.css';

interface BaseModalSurfaceProps {
  dialogRef: RefObject<HTMLDialogElement | null>;
  titleId: string;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size: BaseModalSize;
  presentation: BaseModalPresentation;
  layer: number;
  className?: string;
  isPending: boolean;
  onClose: () => void;
}

export default function BaseModalSurface({
  dialogRef,
  titleId,
  title,
  children,
  footer,
  size,
  presentation,
  layer,
  className,
  isPending,
  onClose,
}: Readonly<BaseModalSurfaceProps>) {
  const { t } = useTranslation();

  return (
    <dialog
      open
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-modal-layer={layer}
      data-presentation={presentation}
      style={{ '--modal-layer': layer } as CSSProperties}
      className={[
        styles.dialog,
        styles[`size_${size}`],
        presentation === 'responsive-sheet' && styles.responsiveSheetDialog,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.header}>
        <h2 id={titleId} dir="auto" className={styles.title}>
          {title}
        </h2>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label={t('close', 'Close')}
          disabled={isPending}
        >
          <X size={20} />
        </button>
      </div>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </dialog>
  );
}
