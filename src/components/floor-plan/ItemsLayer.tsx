import type { KeyboardEvent } from 'react';
import type { FloorPlanItem } from '@/types/floorPlan';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { getSymbol, isMovableItemKind, type SymbolDef } from '@/lib/floorPlan/symbols';
import { isTextLabelKind } from '@/lib/floorPlan/wayfinding';
import FloorPlanSymbol from './FloorPlanSymbol';
import { ZoneRegion } from './WayfindingShapes';
import type { SceneStyles, SelectTable } from './sceneTypes';

/**
 * Structure and decor items (bar, fireplace, plants, …) plus zone regions.
 * Fixed furniture is drawn in the muted scenery ink so it recedes and reads as
 * non-interactive (§4.2). Text labels and the entrance marker are handled by
 * {@link ./LabelsLayer}, above the tables. Each symbol is authored in its own box
 * and scaled to the item's metre footprint; rotation is about the item centre.
 *
 * Items are **scenery for the guest and objects for the admin**. On the guest map
 * no handler is passed, so they stay inert; in the editor `onSelectItem` makes
 * each one focusable and activatable, which is the keyboard path onto an object
 * the pointer picks by footprint (`gestureFromTarget`). Geometry is identical
 * either way — the mirroring test insists on it — so interactivity adds only
 * `role`/`tabIndex`/`aria-*`, never a shape.
 */

interface ItemPartProps {
  item: FloorPlanItem;
  styles: SceneStyles;
}

/** The symbol is resolved by the caller, which already refuses to draw kinds without one. */
function SymbolItem({ item, styles, symbol }: Readonly<ItemPartProps & { symbol: SymbolDef }>) {
  const sx = metresToCm(item.widthMeters) / symbol.w;
  const sy = metresToCm(item.heightMeters) / symbol.h;
  const transform =
    `translate(${metresToCm(item.x)} ${metresToCm(item.y)}) rotate(${item.rotationDegrees}) ` +
    `scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(${-symbol.w / 2} ${-symbol.h / 2})`;
  return (
    <g transform={transform}>
      <FloorPlanSymbol def={symbol} styles={styles} />
    </g>
  );
}

interface ItemsLayerProps {
  items: FloorPlanItem[];
  styles: SceneStyles;
  /** When provided (editor only), each item becomes focusable and selectable. */
  onSelectItem?: SelectTable;
  /** Accessible label for an item (i18n from the consumer). */
  formatItemLabel?: (item: FloorPlanItem) => string;
  /** Which items the editor has picked — announced as the button's pressed state. */
  selectedItemIds?: readonly string[];
}

interface PlacedItemProps extends ItemPartProps {
  onSelectItem?: SelectTable;
  label: string;
  selected: boolean;
}

/**
 * One placed item, wrapped in the group that carries its identity. The wrapper is
 * the *same* element whether or not the item is interactive, so the editor adds
 * behaviour without adding geometry.
 */
function PlacedItem({ item, styles, onSelectItem, label, selected }: Readonly<PlacedItemProps>) {
  const id = item.id;
  const symbol = getSymbol(item.kind);
  const body =
    item.kind === 'zone' ? (
      <ZoneRegion item={item} styles={styles} />
    ) : (
      symbol && <SymbolItem item={item} styles={styles} symbol={symbol} />
    );
  if (!body) {
    // A kind this renderer has no geometry for draws nothing — and must not leave
    // an empty focusable group behind for a screen reader to announce.
    return null;
  }
  const selectable = Boolean(onSelectItem) && Boolean(id) && isMovableItemKind(item.kind);
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
      // Without this a screen-reader user gets no confirmation that activating an
      // object selected it, while the overlay's outline says so visually.
      aria-pressed={selectable ? selected : undefined}
      aria-label={selectable ? label : undefined}
      onClick={selectable ? (e) => select({ additive: e.shiftKey, synthetic: e.detail === 0 }) : undefined}
      onKeyDown={selectable ? handleKeyDown : undefined}
    >
      {body}
    </g>
  );
}

export default function ItemsLayer({
  items,
  styles,
  onSelectItem,
  formatItemLabel,
  selectedItemIds,
}: Readonly<ItemsLayerProps>) {
  const drawn = items
    .filter((it) => !isTextLabelKind(it.kind) && it.kind !== 'entrance')
    .slice()
    .sort((a, b) => a.zIndex - b.zIndex);
  return (
    <g>
      {drawn.map((item) => (
        <PlacedItem
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
