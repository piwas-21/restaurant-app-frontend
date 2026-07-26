import type { KeyboardEvent } from 'react';
import type { FloorPlanItem } from '@/types/floorPlan';
import { isTextLabelKind } from '@/lib/floorPlan/wayfinding';
import { EntranceMarker, TapeLabel } from './WayfindingShapes';
import type { SceneStyles, SelectTable } from './sceneTypes';

/**
 * Wayfinding text on top of the plan (§4.4): masking-tape text tags and the
 * entrance marker. These sit above the tables so they stay legible. Foreground
 * z-order. The shapes themselves live in {@link ./WayfindingShapes}, shared with
 * the editor's palette preview.
 *
 * Like {@link ./ItemsLayer}, these are **scenery for the guest and objects for
 * the admin**: with no `onSelectItem` they are inert; in the editor each becomes
 * a focusable button, which is the keyboard path onto a label the pointer picks
 * by footprint. Geometry is identical either way — the mirroring test insists on
 * it — so interactivity adds only `role`/`tabIndex`/`aria-*`, never a shape.
 */

interface LabelsLayerProps {
  items: FloorPlanItem[];
  styles: SceneStyles;
  /** When provided (editor only), each label becomes focusable and selectable. */
  onSelectItem?: SelectTable;
  formatItemLabel?: (item: FloorPlanItem) => string;
  selectedItemIds?: readonly string[];
}

interface PlacedLabelProps {
  item: FloorPlanItem;
  styles: SceneStyles;
  onSelectItem?: SelectTable;
  label: string;
  selected: boolean;
}

function PlacedLabel({ item, styles, onSelectItem, label, selected }: Readonly<PlacedLabelProps>) {
  const id = item.id;
  const selectable = Boolean(onSelectItem) && Boolean(id);
  const select = (source: Parameters<SelectTable>[1]) => id && onSelectItem?.(id, source);
  const handleKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select({ additive: e.shiftKey, viaKeyboard: true });
    }
  };
  return (
    <g
      data-item-id={id}
      className={selectable ? styles.itemHit : undefined}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-label={selectable ? label : undefined}
      // A guest gets scenery, so it is hidden from them rather than announced as
      // an unlabelled group; the editor's copy is a real, named control.
      aria-hidden={selectable ? undefined : true}
      onClick={selectable ? (e) => select({ additive: e.shiftKey, synthetic: e.detail === 0 }) : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
    >
      {item.kind === 'entrance' ? (
        <EntranceMarker item={item} styles={styles} />
      ) : (
        <TapeLabel item={item} styles={styles} />
      )}
    </g>
  );
}

export default function LabelsLayer({
  items,
  styles,
  onSelectItem,
  formatItemLabel,
  selectedItemIds,
}: Readonly<LabelsLayerProps>) {
  const labels = items.filter((it) => isTextLabelKind(it.kind) || it.kind === 'entrance');
  return (
    <g>
      {labels.map((item) => (
        <PlacedLabel
          key={item.id ?? `${item.kind}-${item.x}-${item.y}-${item.zIndex}`}
          item={item}
          styles={styles}
          onSelectItem={onSelectItem}
          label={formatItemLabel?.(item) ?? item.kind}
          selected={Boolean(item.id && selectedItemIds?.includes(item.id))}
        />
      ))}
    </g>
  );
}
