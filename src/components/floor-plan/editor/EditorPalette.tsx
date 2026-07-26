'use client';

import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import sceneStyles from '../FloorPlanScene.module.css';
import FloorPlanSymbol from '../FloorPlanSymbol';
import { TapeLabel, ZoneRegion } from '../WayfindingShapes';
import { metresToCm } from '@/lib/floorPlan/geometry';
import { PALETTE_GROUPS, paletteEntries, type PaletteEntry } from '@/lib/floorPlan/palette';
import { DEFAULT_ITEM_LABEL, isTextLabelKind } from '@/lib/floorPlan/wayfinding';
import { itemKindLabel } from './itemKindLabel';
import styles from './EditorPalette.module.css';

/**
 * The object palette (FLOOR-PLAN-REVAMP §4.3) — click an entry, then click the
 * plan. That two-click flow is the SC 2.5.7 placement path (no dragging anywhere
 * in it), and it is also simply faster than dragging across a rail.
 *
 * Each entry previews the **real symbol**, rendered by the same component the plan
 * uses, so the rail can never illustrate one thing and place another. Tables sit
 * at the top but are not placeable objects: creating one is a `POST /api/tables`
 * with a number, seats and a QR code behind it, which the whole-document PUT
 * cannot express — so that entry opens the create-table modal instead.
 */
interface EditorPaletteProps {
  /** The armed kind, or null when the palette is idle. */
  armedKind: string | null;
  /**
   * Pick a kind. `viaPointer` is false for a click with no pointer behind it
   * (`MouseEvent.detail === 0` — a keyboard `Enter`/`Space`, voice control or
   * assistive tech), which the editor places immediately: there is no way for
   * such a user to click the canvas afterwards (SC 2.1.1).
   */
  onArm: (kind: string, viaPointer: boolean) => void;
  /** Grid placement from the editor layout (the rail spans on narrow screens). */
  className?: string;
  /**
   * Opens the create-table modal. Hits /api/tables and reloads the plan, so the
   * caller flushes any pending geometry save first — the button itself stays live,
   * because the version that went disabled-while-dirty said nothing about why.
   */
  onAddTable: () => void;
  /** False at the server's per-plan item cap — every entry goes disabled. */
  canPlace: boolean;
}

/**
 * A rail thumbnail. A symbol draws at its own authored box; a wayfinding kind
 * has no box, so it previews through **the very component the layer uses**,
 * placed at the centre of a viewBox its own footprint wide. Illustrating them
 * some other way would let the rail show one thing and place another.
 */
function EntryPreview({ entry }: Readonly<{ entry: PaletteEntry }>) {
  const { symbol, kind, widthMeters, heightMeters } = entry;
  const w = symbol ? symbol.w : metresToCm(widthMeters);
  const h = symbol ? symbol.h : metresToCm(heightMeters);
  // A zone's name tag is drawn ABOVE its region, so the box has to allow for it.
  const padY = kind === 'zone' ? 20 : 0;
  const item = {
    kind,
    x: widthMeters / 2,
    y: heightMeters / 2,
    widthMeters,
    heightMeters,
    rotationDegrees: 0,
    zIndex: 0,
    label: DEFAULT_ITEM_LABEL[kind] ?? null,
  };
  return (
    <span className={styles.preview}>
      <svg
        className={sceneStyles.scene}
        viewBox={`0 ${-padY} ${w} ${h + padY}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        {/* A wayfinding kind has no symbol, so these branches are exclusive. */}
        {symbol && <FloorPlanSymbol def={symbol} styles={sceneStyles} />}
        {kind === 'zone' && <ZoneRegion item={item} styles={sceneStyles} />}
        {isTextLabelKind(kind) && <TapeLabel item={item} styles={sceneStyles} />}
      </svg>
    </span>
  );
}

export default function EditorPalette({
  armedKind,
  onArm,
  className,
  onAddTable,
  canPlace,
}: Readonly<EditorPaletteProps>) {
  const { t } = useTranslation();
  const kindLabel = (kind: string) => itemKindLabel(t, kind);

  return (
    <aside className={[styles.rail, className].filter(Boolean).join(' ')} aria-label={t('editor_palette', 'Objects')}>
      <section className={styles.group}>
        <h3 className={styles.groupHeading}>{t('editor_palette_tables', 'Tables')}</h3>
        <button type="button" className={styles.addTable} onClick={onAddTable}>
          <Plus size={15} aria-hidden="true" />
          {t('editor_add_table', 'Add table')}
        </button>
      </section>

      {PALETTE_GROUPS.map((group) => (
        <section key={group.id} className={styles.group}>
          <h3 className={styles.groupHeading}>{t(`editor_palette_${group.id}`, group.id)}</h3>
          <ul className={styles.entries}>
            {paletteEntries(group).map((entry) => (
              <li key={entry.kind}>
                <button
                  type="button"
                  className={styles.entry}
                  aria-pressed={armedKind === entry.kind}
                  disabled={!canPlace}
                  onClick={(e) => onArm(entry.kind, e.detail !== 0)}
                >
                  <EntryPreview entry={entry} />
                  <span className={styles.entryText}>
                    <span className={styles.entryName}>{kindLabel(entry.kind)}</span>
                    <span className={styles.entrySize}>
                      {/* The same "W × H m" phrasing the resize badge uses — one key,
                          so the two can never disagree about the unit or the order. */}
                      {t('editor_size_badge', '{{width}} × {{height}} m', {
                        width: entry.widthMeters.toFixed(2),
                        height: entry.heightMeters.toFixed(2),
                      })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <output className={styles.hint}>
        {/* Keyboard activation places at once, so the armed hint only ever
            appears for a pointer user who still has to click the plan. */}
        {!canPlace && t('editor_palette_full', 'This plan is full. Delete an object to add another.')}
        {canPlace &&
          armedKind &&
          t('editor_palette_armed', 'Click the plan to place {{object}}. Esc cancels.', {
            object: kindLabel(armedKind),
          })}
        {canPlace && !armedKind && t('editor_palette_hint', 'Pick an object, then click the plan.')}
      </output>
    </aside>
  );
}
