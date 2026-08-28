'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import styles from './SideItemPickerRow.module.css';

interface SideItemPickerRowProps {
  id: string;
  name: string;
  description?: string;
  /** In the draft — i.e. this item WILL be suggested when the picker is applied. */
  checked: boolean;
  /** Was already on the product when the picker opened. A note, not a lock. */
  alreadyAdded?: boolean;
  /** The product being edited. Never selectable, and the row says why. */
  isSelf?: boolean;
  onToggle: (checked: boolean) => void;
}

/**
 * One row of the side-item picker: a tick box carrying the dish name, its description under it, and
 * a note on the end.
 *
 * **The tick box is the whole feature (D12).** The ingredient library draws an already-attached row
 * TICKED and DISABLED, because attaching the same ingredient twice is the only thing that could
 * happen there and it is meaningless. Here the second thing an admin wants is exactly to take a
 * suggestion OFF, so an already-added row is ticked and **live**: unticking it is the removal that
 * the surface this replaces had no control for at all. It keeps the `already added` note — that is
 * what says the tick is a stored fact rather than something the admin just did — and it keeps the
 * dimmed background, so the two states still read apart at a glance.
 *
 * `isSelf` is the one row that IS disabled, and it is disabled unticked with the reason spelled out
 * rather than hidden: a dish that is missing from a search it plainly matches is a bug report
 * waiting to be filed, and the reason is not guessable from an absence.
 */
export default function SideItemPickerRow({
  id,
  name,
  description,
  checked,
  alreadyAdded = false,
  isSelf = false,
  onToggle,
}: Readonly<SideItemPickerRowProps>) {
  const { t } = useTranslation();
  const noteId = `side-item-note-${id}`;
  const note = isSelf ? t('side_items_picker_self') : alreadyAdded ? t('already_added') : null;

  return (
    <li className={`${styles.row} ${alreadyAdded || isSelf ? styles.rowMuted : ''}`}>
      <div className={styles.identity}>
        <CheckboxField
          label={name}
          checked={isSelf ? false : checked}
          disabled={isSelf}
          onChange={onToggle}
          describedBy={note ? noteId : undefined}
        />
        {/* `dir="auto"`: a dish description is tenant-authored text in whatever language the menu is
            written in, which the page direction does not know (DESIGN-SYSTEM.md §8.2). */}
        {description && (
          <p className={styles.description} dir="auto">
            {description}
          </p>
        )}
      </div>
      {note && (
        <span className={styles.note} id={noteId}>
          {note}
        </span>
      )}
    </li>
  );
}
