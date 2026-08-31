'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './ProductIngredientRow.module.css';

interface RowMoveButtonsProps {
  // readonly: S6759 — component props are never mutated.
  /** Position of the row WITHIN its table, zero-based. Only used to label the buttons. */
  readonly index: number;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onMove: (index: number, delta: -1 | 1) => void;
}

/**
 * The leading `<td>` of a reorderable row — frontend **#593**, editor plan slice **S8**.
 *
 * ONE component for BOTH tables. The recipe rows and the variation rows already share
 * `ProductIngredientRow.module.css` on purpose (the screens draw the two tables identically and a
 * second copy of the rules is a second thing to keep in step); sharing the markup as well is what
 * keeps their labels, their icon size and their disabled behaviour from drifting apart.
 *
 * **Buttons, not a drag handle, and that is the decision rather than a shortfall.** The approved
 * screens (`recipe_dietary_details_split_view`, `pricing_variations_detail_margherita_pizza`) draw
 * a handle; #593 requires a keyboard path either way, and a drag-only handle would be a control
 * half of this editor's users cannot reach — the same accessibility bar the rest of the editor is
 * held to. Drag can be layered on top later, as an enhancement over something that already works.
 *
 * They are DISABLED at the ends of the list, not hidden. A control that vanishes makes the row
 * jump under the pointer and leaves the admin unsure whether reordering exists at all; `disabled`
 * says "not from here".
 *
 * Labelled by POSITION, not by the row's name: a row added a second ago has no name yet, and
 * "Move  up" is what an empty interpolation renders.
 */
export default function RowMoveButtons({ index, canMoveUp, canMoveDown, onMove }: RowMoveButtonsProps) {
  const { t } = useTranslation();

  return (
    <td className={styles.moveCell} data-label={t('reorder')}>
      <button
        type="button"
        className={styles.moveButton}
        onClick={() => onMove(index, -1)}
        disabled={!canMoveUp}
        aria-label={t('move_row_up', { position: index + 1 })}
      >
        <ChevronUp size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.moveButton}
        onClick={() => onMove(index, 1)}
        disabled={!canMoveDown}
        aria-label={t('move_row_down', { position: index + 1 })}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>
    </td>
  );
}
