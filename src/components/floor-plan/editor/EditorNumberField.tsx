'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import FormField from '@/components/design-system/FormField';
import styles from './EditorInspector.module.css';

/**
 * A numeric inspector field (FLOOR-PLAN-REVAMP §4.3 — the no-drag path for exact
 * placement). Local edit state keeps typing smooth; the value commits on blur or
 * Enter (rounded to 2dp, the backend's `decimal(6,2)` precision) and re-syncs
 * when the underlying table changes from a drag / undo. An invalid entry reverts.
 */
interface EditorNumberFieldProps {
  label: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
}

export default function EditorNumberField({
  label,
  value,
  step = 0.1,
  min,
  max,
  onCommit,
}: Readonly<EditorNumberFieldProps>) {
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText(String(value));
  }, [value]);

  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed) && text.trim() !== '') {
      // Clamp to the field's bounds so a typed value can't sit where Save would
      // silently move it (the backend clamps position to [0,width], size to
      // [0.1,width]); the drag path clamps for the same reason.
      let next = Math.round(parsed * 100) / 100;
      if (min !== undefined) next = Math.max(next, min);
      if (max !== undefined) next = Math.min(next, max);
      if (next !== value) {
        onCommit(next);
        return;
      }
    }
    setText(String(value));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <FormField label={label} className={styles.field}>
      <input
        className={styles.number}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </FormField>
  );
}
