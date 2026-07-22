import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { getTableMarkerStyle } from '@/lib/tableCanvasGeometry';
import styles from './TableMarker.module.css';

interface TableMarkerProps {
  tableNumber: string;
  maxGuests: number;
  positionX: number;
  positionY: number;
  ariaLabel: string;
  /** State classes from the owning renderer's module (selected, booked, …). */
  className?: string;
  ariaPressed?: boolean;
  disabled?: boolean;
  cursor?: CSSProperties['cursor'];
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onMouseDown?: MouseEventHandler<HTMLButtonElement>;
  /** Optional overlays (admin badges) rendered inside the marker. */
  children?: ReactNode;
}

/**
 * The ONE uniform table marker used by both the customer reservation map and
 * the admin layout editor: a simple table glyph + table number + seat count,
 * centre-anchored on (positionX, positionY) and sized in canvas-percent units
 * (see `lib/tableCanvasGeometry`) so admin/customer parity is exact.
 */
export default function TableMarker({
  tableNumber,
  maxGuests,
  positionX,
  positionY,
  ariaLabel,
  className,
  ariaPressed,
  disabled = false,
  cursor,
  onClick,
  onMouseDown,
  children,
}: Readonly<TableMarkerProps>) {
  return (
    <button
      type="button"
      className={`${styles.marker} ${className ?? ''}`}
      style={{ ...getTableMarkerStyle(positionX, positionY), cursor }}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
    >
      <svg className={styles.glyph} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M2 7.5h20a1 1 0 0 1 0 2h-1.4l1.35 6.8a1 1 0 0 1-1.96.4l-.75-3.7H4.76l-.75 3.7a1 1 0 0 1-1.96-.4l1.35-6.8H2a1 1 0 0 1 0-2Zm3.44 2 -.28 1.5h13.68l-.28-1.5H5.44Z"
        />
      </svg>
      <span className={styles.tableNumber}>{tableNumber}</span>
      <span className={styles.guestCount}>👥 {maxGuests}</span>
      {children}
    </button>
  );
}
