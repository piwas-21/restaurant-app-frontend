import type { FloorPlanTableShape } from '@/types/floorPlan';

/**
 * Table body geometry (FLOOR-PLAN-REVAMP §4.2, ported from the prototype's
 * `tableBody`). Given a table's shape, seat count and footprint in metres, this
 * returns the top plus a chair for every seat, laid out around the footprint —
 * so capacity is readable at a glance and a rotated 8-top still *looks* like an
 * 8-top. Everything is table-local centimetres centred on (0,0); the renderer
 * translates to the table's plan position and rotates the whole group about that
 * centre. Pure and skin-independent: this is what makes the guest map and the
 * admin editor render byte-identical geometry (the mirroring guarantee).
 */

/** Chair footprint in centimetres (a seat mark drawn around the table). */
const CHAIR_WIDTH = 42;
const CHAIR_DEPTH = 15;
const CHAIR_GAP = 7;
const CHAIR_RADIUS = 5;
/** Booth bench-back thickness in centimetres. */
const BOOTH_BACK = 16;
const BOOTH_BACK_RADIUS = 7;
const TOP_RADIUS = 6;

/** A seat mark: a rounded rectangle centred on (cx, cy), rotated about it. */
export interface ChairRect {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rx: number;
  /** Degrees, clockwise, about (cx, cy). */
  angle: number;
}

export interface TableTopCircle {
  kind: 'circle';
  r: number;
}

export interface TableTopRect {
  kind: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

export type TableTop = TableTopCircle | TableTopRect;

/** A booth bench back — a thick rounded bar behind a side of the top. */
export interface BoothBack {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
}

export interface TableParts {
  top: TableTop;
  chairs: ChairRect[];
  backs: BoothBack[];
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;

/** How many seats go on each side of a rectangular / square top. */
function splitSeats(
  seats: number,
  width: number,
  height: number,
  shape: FloorPlanTableShape,
): { top: number; bottom: number; left: number; right: number } {
  if (shape === 'square' && seats === 4) {
    return { top: 1, bottom: 1, left: 1, right: 1 };
  }
  // A long table (aspect ≥ 2.2) that seats 8+ gets a chair on each short end.
  const ends = width / height >= 2.2 && seats >= 8 ? 2 : 0;
  const side = seats - ends;
  const top = Math.ceil(side / 2);
  return { top, bottom: side - top, left: ends / 2, right: ends / 2 };
}

const chair = (cx: number, cy: number, angle: number): ChairRect => ({
  cx,
  cy,
  width: CHAIR_WIDTH,
  height: CHAIR_DEPTH,
  rx: CHAIR_RADIUS,
  angle,
});

/** Evenly spaced offsets for `count` chairs along a side of length `len`. */
function alongSide(count: number, len: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 0.5) * (len / count) - len / 2);
}

/**
 * Resolve a table's parts. `widthMeters`/`heightMeters` are the footprint; the
 * seat count is clamped to at least one so a mis-seeded table still draws.
 */
export function tableParts(
  shape: FloorPlanTableShape,
  seats: number,
  widthMeters: number,
  heightMeters: number,
): TableParts {
  const width = widthMeters * 100;
  const height = heightMeters * 100;
  const count = Math.max(1, Math.floor(seats));

  if (shape === 'round') {
    const r = width / 2;
    const ring = r + CHAIR_GAP + CHAIR_DEPTH / 2;
    const chairs = Array.from({ length: count }, (_, i) => {
      const angle = -90 + (360 / count) * i;
      return chair(Math.cos(rad(angle)) * ring, Math.sin(rad(angle)) * ring, angle + 90);
    });
    return { top: { kind: 'circle', r }, chairs, backs: [] };
  }

  if (shape === 'booth') {
    return {
      top: { kind: 'rect', x: -width / 2, y: -height / 2, width, height, rx: TOP_RADIUS },
      chairs: [],
      backs: [
        { x: -width / 2, y: -height / 2 - CHAIR_GAP - BOOTH_BACK, width, height: BOOTH_BACK, rx: BOOTH_BACK_RADIUS },
        { x: -width / 2, y: height / 2 + CHAIR_GAP, width, height: BOOTH_BACK, rx: BOOTH_BACK_RADIUS },
      ],
    };
  }

  // square / rectangle: chairs ranged along each occupied side.
  const s = splitSeats(count, width, height, shape);
  const offY = height / 2 + CHAIR_GAP + CHAIR_DEPTH / 2;
  const offX = width / 2 + CHAIR_GAP + CHAIR_DEPTH / 2;
  const chairs: ChairRect[] = [
    ...alongSide(s.top, width).map((x) => chair(x, -offY, 0)),
    ...alongSide(s.bottom, width).map((x) => chair(x, offY, 180)),
    ...alongSide(s.left, height).map((y) => chair(-offX, y, 90)),
    ...alongSide(s.right, height).map((y) => chair(offX, y, 270)),
  ];
  return {
    top: { kind: 'rect', x: -width / 2, y: -height / 2, width, height, rx: TOP_RADIUS },
    chairs,
    backs: [],
  };
}
