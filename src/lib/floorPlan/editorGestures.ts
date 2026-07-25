import type { FloorPlanDocument, FloorPlanPoint } from '@/types/floorPlan';
import {
  ROTATION_STEP_FREE,
  alignmentSnap,
  rotationStep,
  snapAngle,
  snapToGrid,
  type AlignmentGuide,
} from './snapping';
import { clampCentreToPlan } from './editorGeometry';
import { findMovable, itemMovable, otherMovableRects, type Movable, type MovableGeometry } from './movable';
import { ROTATE_HANDLE, angleFromPointer, resizeHandle, resizeRect, type HandleAnchor } from './handles';
import { pointInRect } from './geometry';

/**
 * The editor's pointer gestures (FLOOR-PLAN-REVAMP §4.3). A gesture is captured
 * from whatever the pointer pressed and then resolved on every move into a
 * geometry patch plus the alignment guides to draw — so `useEditorDrag` stays a
 * thin event layer and "drag a rotated table by its corner" is unit-tested rather
 * than eyeballed. Both halves are pure functions of their arguments, and both
 * work on any {@link Movable}: a placed plant moves, rotates and resizes through
 * exactly the code a table does.
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
export const MIN_MOVABLE_SIZE_M = 0.3;

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
  patch: Partial<MovableGeometry>;
  guides: AlignmentGuide[];
}

/**
 * The topmost item under the pointer, hit-tested against its real (rotated)
 * **footprint** rather than its drawn ink. Items are scenery — a plant is a few
 * thin strokes, a rug is an outline — so a DOM hit test would demand
 * pixel-perfect aim at exactly the objects that are hardest to hit. `padMeters`
 * is the caller's screen-pixel grab tolerance, which keeps a 40 cm stool
 * grabbable on a fitted plan. Later items are drawn on top, so the search runs
 * backwards.
 */
function itemAt(doc: FloorPlanDocument, point: FloorPlanPoint, padMeters: number): Movable | null {
  // Ordered by the same zIndex the renderer stacks by, highest first, so "topmost"
  // means the same thing to the pointer as it does on screen. (The API happens to
  // return items in zIndex order today; a z-order control would end that.)
  // `itemMovable` drops what the editor does not manage — zones, labels, the
  // entrance marker — so none of them can be grabbed through this slice's panel.
  const items = doc.items
    .toSorted((a, b) => b.zIndex - a.zIndex)
    .map((item) => itemMovable(item))
    .filter((m): m is Movable => m !== null);
  return items.find((m) => pointInRect(m, point, padMeters)) ?? null;
}

/**
 * Which gesture a pointer press starts: a grip on the current selection, else a
 * move of whatever was pressed, else nothing (the caller marquees or pans
 * instead). Grips belong to a *single* selection — with several objects picked
 * none are drawn, so none can be pressed. **Tables win over items**, because a
 * table is the interactive object and items are the scenery it stands on.
 */
export function gestureFromTarget(
  target: Element,
  doc: FloorPlanDocument,
  selectedIds: readonly string[],
  point: FloorPlanPoint,
  hitPadMeters = 0,
): Gesture | null {
  const handleId = target.closest<SVGElement>('[data-handle]')?.dataset.handle;
  const selected = selectedIds.length === 1 ? findMovable(doc, selectedIds[0]) : null;
  if (handleId && selected) {
    if (handleId === ROTATE_HANDLE) {
      // The grip's hit ring is far wider than the grip, so record where on it the
      // press landed and rotate by the change — otherwise grabbing the ring's
      // edge snaps the object through the angle between the two.
      const grabAngle = angleFromPointer(selected, point) - selected.rotationDegrees;
      return { kind: 'rotate', id: selected.id, grabAngle };
    }
    const anchor = resizeHandle(handleId);
    return anchor ? { kind: 'resize', id: selected.id, anchor } : null;
  }
  const tableId = target.closest<SVGGElement>('[data-table-id]')?.dataset.tableId;
  const grabbed = tableId ? findMovable(doc, tableId) : itemAt(doc, point, hitPadMeters);
  return grabbed ? { kind: 'move', id: grabbed.id, grabX: grabbed.x - point.x, grabY: grabbed.y - point.y } : null;
}

/** Is positional snapping active? Alt suspends it for the length of the gesture. */
const snapping = (input: GestureInput): boolean => input.snapEnabled && !input.modifiers.alt;

function resolveMove(
  gesture: Extract<Gesture, { kind: 'move' }>,
  movable: Movable,
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
      { ...movable, x: cx, y: cy },
      otherMovableRects(doc, movable.id),
      input.toleranceMeters,
    );
    cx = aligned.x;
    cy = aligned.y;
    guides = aligned.guides;
  }
  const centre = clampCentreToPlan(cx, cy, doc);
  return { patch: { x: centre.x, y: centre.y }, guides };
}

function resolveRotate(
  gesture: Extract<Gesture, { kind: 'rotate' }>,
  movable: Movable,
  input: GestureInput,
): GestureResult {
  const raw = angleFromPointer(movable, input.point) - gesture.grabAngle;
  const step = input.snapEnabled ? rotationStep(input.modifiers) : ROTATION_STEP_FREE;
  return { patch: { rotationDegrees: snapAngle(raw, step) }, guides: [] };
}

function resolveResize(
  gesture: Extract<Gesture, { kind: 'resize' }>,
  movable: Movable,
  input: GestureInput,
): GestureResult {
  const doc = input.document;
  const next = resizeRect(movable, gesture.anchor, input.point, {
    // A canvas floor above the server's 0.1 m: anything smaller is unusable to
    // grab. Bigger than the room is what the server would silently clamp, so
    // bound it here to keep the canvas and the saved plan the same shape.
    minSizeMeters: MIN_MOVABLE_SIZE_M,
    maxWidthMeters: doc.widthMeters,
    maxHeightMeters: doc.heightMeters,
    snapStepMeters: snapping(input) ? doc.gridSizeCm / 100 : undefined,
  });
  // Clamp like a move: the server clamps the centre too, so a resize can never
  // leave the object somewhere Save would silently pull it back from.
  const centre = clampCentreToPlan(next.x, next.y, doc);
  return {
    patch: { x: centre.x, y: centre.y, widthMeters: next.widthMeters, heightMeters: next.heightMeters },
    guides: [],
  };
}

/**
 * Resolve a live gesture against the current document. Returns null when the
 * gesture's object has gone (e.g. a reload landed mid-drag), which the caller
 * treats as "nothing to preview".
 */
export function resolveGesture(gesture: Gesture, input: GestureInput): GestureResult | null {
  const movable = findMovable(input.document, gesture.id);
  if (!movable) {
    return null;
  }
  switch (gesture.kind) {
    case 'move':
      return resolveMove(gesture, movable, input);
    case 'rotate':
      return resolveRotate(gesture, movable, input);
    default:
      return resolveResize(gesture, movable, input);
  }
}
