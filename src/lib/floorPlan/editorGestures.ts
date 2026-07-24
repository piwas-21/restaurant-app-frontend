import type { FloorPlanDocument, FloorPlanPoint, FloorPlanTableGeometry } from '@/types/floorPlan';
import {
  ROTATION_STEP_FREE,
  alignmentSnap,
  rotationStep,
  snapAngle,
  snapToGrid,
  type AlignmentGuide,
} from './snapping';
import { clampCentreToPlan, otherTableRects, tableOrientedRect, tableSnapRect } from './editorGeometry';
import { ROTATE_HANDLE, angleFromPointer, resizeHandle, resizeRect, type HandleAnchor } from './handles';

/**
 * The editor's pointer gestures (FLOOR-PLAN-REVAMP §4.3). A gesture is captured
 * from whatever the pointer pressed and then resolved on every move into a table
 * patch plus the alignment guides to draw — so `useEditorDrag` stays a thin event
 * layer and "drag a rotated table by its corner" is unit-tested rather than
 * eyeballed. Both halves are pure functions of their arguments.
 *
 * Modifiers follow §4.4: **Alt** suspends grid/alignment snapping while moving
 * or resizing, and selects the coarse 90° step while rotating; **Shift** drops
 * rotation to a free 1°.
 *
 * Note that `Shift` deliberately reads the *other* way on the keyboard (`Shift+[`
 * is ∓90°, `Shift+Arrow` is a ten-unit nudge — see `useEditorKeyboard`): each
 * surface is internally consistent, a pointer modifier refining a continuous drag
 * and a keyboard modifier amplifying a discrete step. §4.3 specifies both.
 */

/** The smallest footprint a canvas resize may produce (metres). */
export const MIN_TABLE_SIZE_M = 0.3;

export type Gesture =
  | { kind: 'move'; id: string; grabX: number; grabY: number }
  /** `grabAngle` is where on the ring the press landed, so rotation never jumps. */
  | { kind: 'rotate'; id: string; grabAngle: number }
  | { kind: 'resize'; id: string; anchor: HandleAnchor };

export type GestureKind = Gesture['kind'];

export interface GestureInput {
  document: FloorPlanDocument;
  /** The pointer in plan metres. */
  point: FloorPlanPoint;
  modifiers: { alt: boolean; shift: boolean };
  snapEnabled: boolean;
  /** Alignment tolerance in metres — a screen-pixel threshold through the zoom. */
  toleranceMeters: number;
}

export interface GestureResult {
  patch: Partial<FloorPlanTableGeometry>;
  guides: AlignmentGuide[];
}

/**
 * Which gesture a pointer press starts: a grip on the current selection, else a
 * move of whatever table was pressed, else nothing (the caller pans instead).
 */
export function gestureFromTarget(
  target: Element,
  doc: FloorPlanDocument,
  selectedId: string | null,
  point: FloorPlanPoint,
): Gesture | null {
  const handleId = target.closest<SVGElement>('[data-handle]')?.dataset.handle;
  const selected = selectedId ? doc.tables.find((t) => t.id === selectedId) : undefined;
  if (handleId && selected) {
    if (handleId === ROTATE_HANDLE) {
      // The grip's hit ring is far wider than the grip, so record where on it the
      // press landed and rotate by the change — otherwise grabbing the ring's
      // edge snaps the table through the angle between the two.
      const centre = { x: selected.positionX, y: selected.positionY };
      return { kind: 'rotate', id: selected.id, grabAngle: angleFromPointer(centre, point) - selected.rotation };
    }
    const anchor = resizeHandle(handleId);
    return anchor ? { kind: 'resize', id: selected.id, anchor } : null;
  }
  const id = target.closest<SVGGElement>('[data-table-id]')?.dataset.tableId;
  const table = id ? doc.tables.find((t) => t.id === id) : undefined;
  return table
    ? { kind: 'move', id: table.id, grabX: table.positionX - point.x, grabY: table.positionY - point.y }
    : null;
}

/** Is positional snapping active? Alt suspends it for the length of the gesture. */
const snapping = (input: GestureInput): boolean => input.snapEnabled && !input.modifiers.alt;

function resolveMove(
  gesture: Extract<Gesture, { kind: 'move' }>,
  table: FloorPlanTableGeometry,
  input: GestureInput,
): GestureResult {
  const doc = input.document;
  let cx = input.point.x + gesture.grabX;
  let cy = input.point.y + gesture.grabY;
  let guides: AlignmentGuide[] = [];
  if (snapping(input)) {
    cx = snapToGrid(cx, doc.gridSizeCm);
    cy = snapToGrid(cy, doc.gridSizeCm);
    const aligned = alignmentSnap(
      { ...tableSnapRect(table), x: cx, y: cy },
      otherTableRects(doc.tables, table.id),
      input.toleranceMeters,
    );
    cx = aligned.x;
    cy = aligned.y;
    guides = aligned.guides;
  }
  const centre = clampCentreToPlan(cx, cy, doc);
  return { patch: { positionX: centre.x, positionY: centre.y }, guides };
}

function resolveRotate(
  gesture: Extract<Gesture, { kind: 'rotate' }>,
  table: FloorPlanTableGeometry,
  input: GestureInput,
): GestureResult {
  const raw = angleFromPointer({ x: table.positionX, y: table.positionY }, input.point) - gesture.grabAngle;
  const step = input.snapEnabled ? rotationStep(input.modifiers) : ROTATION_STEP_FREE;
  return { patch: { rotation: snapAngle(raw, step) }, guides: [] };
}

function resolveResize(
  gesture: Extract<Gesture, { kind: 'resize' }>,
  table: FloorPlanTableGeometry,
  input: GestureInput,
): GestureResult {
  const doc = input.document;
  const next = resizeRect(tableOrientedRect(table), gesture.anchor, input.point, {
    // A canvas floor above the server's 0.1 m: anything smaller is unusable to
    // grab. Bigger than the room is what the server would silently clamp, so
    // bound it here to keep the canvas and the saved plan the same shape.
    minSizeMeters: MIN_TABLE_SIZE_M,
    maxWidthMeters: doc.widthMeters,
    maxHeightMeters: doc.heightMeters,
    snapStepMeters: snapping(input) ? doc.gridSizeCm / 100 : undefined,
  });
  // Clamp like a move: the server clamps the centre too, so a resize can never
  // leave the table somewhere Save would silently pull it back from.
  const centre = clampCentreToPlan(next.x, next.y, doc);
  return {
    patch: { positionX: centre.x, positionY: centre.y, width: next.widthMeters, height: next.heightMeters },
    guides: [],
  };
}

/**
 * Resolve a live gesture against the current document. Returns null when the
 * gesture's table has gone (e.g. a reload landed mid-drag), which the caller
 * treats as "nothing to preview".
 */
export function resolveGesture(gesture: Gesture, input: GestureInput): GestureResult | null {
  const table = input.document.tables.find((t) => t.id === gesture.id);
  if (!table) {
    return null;
  }
  switch (gesture.kind) {
    case 'move':
      return resolveMove(gesture, table, input);
    case 'rotate':
      return resolveRotate(gesture, table, input);
    default:
      return resolveResize(gesture, table, input);
  }
}
