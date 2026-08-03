'use client';

import React from 'react';
import { Check } from 'lucide-react';
import styles from './TaxSelectionModal.module.css';

interface TaxOptionCardProps {
  isSelected: boolean;
  onSelect: () => void;
  name: string;
  description?: string;
  /** Already formatted, e.g. "7.70%". */
  rate: string;
  /** The order-type badges, when the option has any. */
  children?: React.ReactNode;
}

/**
 * One selectable tax option.
 *
 * Extracted because `TaxSelectionModal` rendered this markup twice — once for "No Tax" and once per
 * configuration — and the accessibility fix below would otherwise have had to be made, and kept in
 * step, in both.
 *
 * **It is a radio, not a div that happens to be clickable.** Sonar flagged the original as S6848
 * (non-native interactive element) and S1082 (a visible non-interactive element with a click
 * handler and no keyboard listener) — the second is typed a BUG, and is what failed the PR's
 * `new_reliability_rating` gate. Both were pre-existing; the slice-7 refactor moved the lines, which
 * is what made Sonar treat them as new code. Worth fixing rather than accepting: a keyboard-only
 * admin could focus nothing here and select nothing.
 *
 * `role="radio"` + `aria-checked` + `tabIndex` + Enter/Space mirrors the pattern the palette picker
 * in `AppearanceTab` already uses. The caller supplies the `role="radiogroup"` wrapper — a radio
 * outside a group is announced without its set size or position.
 */
export default function TaxOptionCard({ isSelected, onSelect, name, description, rate, children }: TaxOptionCardProps) {
  return (
    <div
      className={`${styles.taxCard} ${isSelected ? styles.selected : ''}`}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        // Enter and Space are what a radio responds to; `preventDefault` stops Space scrolling.
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className={styles.taxInfo}>
        <h3 className={styles.taxName}>{name}</h3>
        <p className={styles.taxDescription}>{description}</p>
        {children && <div className={styles.applicableTypes}>{children}</div>}
      </div>
      <div className={styles.taxRate}>{rate}</div>
      {isSelected && (
        <div className={styles.checkmark}>
          <Check size={20} />
        </div>
      )}
    </div>
  );
}
