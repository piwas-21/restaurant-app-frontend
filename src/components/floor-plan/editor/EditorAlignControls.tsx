'use client';

import { useTranslation } from 'react-i18next';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
} from 'lucide-react';
import type { AlignEdge, PlanAxis } from '@/lib/floorPlan/align';
import styles from './EditorInspector.module.css';

/**
 * Align and distribute for a multi-object selection (FLOOR-PLAN-REVAMP §4.3) —
 * tables and placed items alike, so a row of stools lines up along a bar the same
 * way a row of tables lines up. These are the **no-drag** way to arrange a group
 * (SC 2.5.7) and, on any plan bigger than a few tables, the fast way — dragging
 * each one onto a shared line by hand is exactly what made the old plan never
 * match the room.
 */

const EDGES: { key: AlignEdge; Icon: typeof AlignStartVertical; label: string; fallback: string }[] = [
  { key: 'left', Icon: AlignStartVertical, label: 'editor_align_left', fallback: 'Align left' },
  { key: 'centerX', Icon: AlignCenterVertical, label: 'editor_align_center_x', fallback: 'Align centres' },
  { key: 'right', Icon: AlignEndVertical, label: 'editor_align_right', fallback: 'Align right' },
  { key: 'top', Icon: AlignStartHorizontal, label: 'editor_align_top', fallback: 'Align top' },
  { key: 'middleY', Icon: AlignCenterHorizontal, label: 'editor_align_middle_y', fallback: 'Align middles' },
  { key: 'bottom', Icon: AlignEndHorizontal, label: 'editor_align_bottom', fallback: 'Align bottom' },
];

const AXES: { key: PlanAxis; Icon: typeof AlignStartVertical; label: string; fallback: string }[] = [
  {
    key: 'x',
    Icon: AlignHorizontalDistributeCenter,
    label: 'editor_distribute_x',
    fallback: 'Space evenly across',
  },
  { key: 'y', Icon: AlignVerticalDistributeCenter, label: 'editor_distribute_y', fallback: 'Space evenly down' },
];

interface IconRowProps<T extends string> {
  group: string;
  items: { key: T; Icon: typeof AlignStartVertical; label: string; fallback: string }[];
  disabled?: boolean;
  onPick: (key: T) => void;
}

/** One row of equal-weight, icon-only, fully-labelled buttons. */
function IconRow<T extends string>({ group, items, disabled, onPick }: Readonly<IconRowProps<T>>) {
  const { t } = useTranslation();
  return (
    // A native <fieldset> carries the grouping semantics that role="group" only
    // approximates, and reads correctly on every screen reader (Sonar S6819).
    <fieldset className={styles.iconRow} aria-label={group}>
      {items.map(({ key, Icon, label, fallback }) => (
        <button
          key={key}
          type="button"
          className={styles.iconButton}
          disabled={disabled}
          onClick={() => onPick(key)}
          aria-label={t(label, fallback)}
          title={t(label, fallback)}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      ))}
    </fieldset>
  );
}

interface EditorAlignControlsProps {
  count: number;
  onAlign: (edge: AlignEdge) => void;
  onDistribute: (axis: PlanAxis) => void;
}

export default function EditorAlignControls({ count, onAlign, onDistribute }: Readonly<EditorAlignControlsProps>) {
  const { t } = useTranslation();
  // Two objects can line up but have nothing between them to space out.
  const canDistribute = count >= 3;

  return (
    <>
      <IconRow group={t('editor_align', 'Align')} items={EDGES} onPick={onAlign} />
      <IconRow
        group={t('editor_distribute', 'Distribute')}
        items={AXES}
        disabled={!canDistribute}
        onPick={onDistribute}
      />
      {!canDistribute && (
        <p className={styles.lockHint}>
          {t('editor_distribute_objects_hint', 'Select three or more objects to space them.')}
        </p>
      )}
    </>
  );
}
