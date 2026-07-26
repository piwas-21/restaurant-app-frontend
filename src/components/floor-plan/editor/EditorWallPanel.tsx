'use client';

import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { FloorPlanDocument, FloorPlanOpening, FloorPlanOpeningKind, FloorPlanWall } from '@/types/floorPlan';
import { FLOOR_STYLES, DEFAULT_FLOOR_STYLE, isFloorStyle } from '@/lib/floorPlan/floorStyles';
import { polygonAreaM2, roomPolygonPoints, wallSegments } from '@/lib/floorPlan/walls';
import EditorNumberField from './EditorNumberField';
import EditorOpeningsPanel from './EditorOpeningsPanel';
import EditorVertexFields from './EditorVertexFields';
import styles from './EditorInspector.module.css';

/**
 * The selected wall's panel (FLOOR-PLAN-REVAMP §4.3). A wall is a polyline, not a
 * footprint, so it gets none of the X/Y/W/H fields the movable panels share —
 * what it has instead is its thickness, and, once it encloses an area, a **room
 * name and a floor finish**.
 *
 * Closing a chain is what makes a room, so the room fields appear exactly when
 * `isClosed` is true rather than behind a separate "make this a room" control
 * that could disagree with the geometry.
 *
 * Its two sub-panels are the no-drag halves of the canvas grips: corners
 * ({@link ./EditorVertexFields}) and openings ({@link ./EditorOpeningsPanel}).
 */

/** The server's clamp on `ThicknessMeters` (`FloorPlanDocumentMapper.BuildWall`). */
const MIN_THICKNESS_M = 0.02;
const MAX_THICKNESS_M = 1;

/** `FloorPlanWallConfiguration` caps `RoomName` at 80 characters. */
const MAX_ROOM_NAME = 80;

interface EditorWallPanelProps {
  wall: FloorPlanWall;
  plan: Pick<FloorPlanDocument, 'widthMeters' | 'heightMeters'>;
  selectedVertex: number | null;
  onPatch: (patch: Partial<FloorPlanWall>) => void;
  onDelete: () => void;
  onSelectVertex: (index: number | null) => void;
  onMoveVertex: (index: number, x: number, y: number) => void;
  onRemoveVertex: (index: number) => void;
  onAddOpening: (segmentIndex: number, kind: FloorPlanOpeningKind) => void;
  onPatchOpening: (openingId: string, patch: Partial<FloorPlanOpening>) => void;
  onRemoveOpening: (openingId: string) => void;
}

export default function EditorWallPanel({
  wall,
  plan,
  selectedVertex,
  onPatch,
  onDelete,
  onSelectVertex,
  onMoveVertex,
  onRemoveVertex,
  onAddOpening,
  onPatchOpening,
  onRemoveOpening,
}: Readonly<EditorWallPanelProps>) {
  const { t } = useTranslation();
  const segments = wallSegments(wall);
  const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
  const area = polygonAreaM2(roomPolygonPoints(wall));
  const floorStyle = isFloorStyle(wall.floorStyle) ? wall.floorStyle : DEFAULT_FLOOR_STYLE;

  return (
    <>
      <h2 className={styles.heading}>{wall.isClosed ? t('editor_room', 'Room') : t('editor_wall', 'Wall')}</h2>
      <p className={styles.meta}>
        {t('editor_wall_meta', '{{vertices}} corners · {{length}} m', {
          vertices: wall.points.length,
          length: totalLength.toFixed(2),
        })}
        {wall.isClosed && ` · ${t('editor_room_area', '{{area}} m²', { area: area.toFixed(1) })}`}
      </p>

      {wall.isClosed && (
        <>
          <FormField label={t('editor_room_name', 'Room name')} className={styles.field}>
            <input
              className={styles.number}
              type="text"
              maxLength={MAX_ROOM_NAME}
              value={wall.roomName ?? ''}
              // Empty is stored as null, not "": the renderer skips a room name
              // that is absent, and an empty string would draw an empty label box.
              onChange={(e) => onPatch({ roomName: e.target.value.trim() === '' ? null : e.target.value })}
            />
          </FormField>

          <FormField label={t('editor_floor_style', 'Floor')} className={styles.field}>
            <select
              className={styles.select}
              value={floorStyle}
              onChange={(e) => onPatch({ floorStyle: e.target.value })}
            >
              {FLOOR_STYLES.map((style) => (
                <option key={style} value={style}>
                  {t(`editor_floor_${style}`, style)}
                </option>
              ))}
            </select>
          </FormField>
        </>
      )}

      <EditorNumberField
        label={t('editor_wall_thickness', 'Thickness (m)')}
        value={wall.thicknessMeters}
        step={0.01}
        min={MIN_THICKNESS_M}
        max={MAX_THICKNESS_M}
        onCommit={(value) => onPatch({ thicknessMeters: value })}
      />

      <EditorVertexFields
        wall={wall}
        plan={plan}
        selectedVertex={selectedVertex}
        onSelectVertex={onSelectVertex}
        onMove={onMoveVertex}
        onRemove={onRemoveVertex}
      />

      <EditorOpeningsPanel wall={wall} onAdd={onAddOpening} onPatch={onPatchOpening} onRemove={onRemoveOpening} />

      <div className={styles.actions}>
        <button type="button" className={styles.actionDanger} onClick={onDelete}>
          <Trash2 size={15} aria-hidden="true" />{' '}
          {wall.isClosed ? t('editor_delete_room', 'Delete room') : t('editor_delete_wall', 'Delete wall')}
        </button>
      </div>
    </>
  );
}
