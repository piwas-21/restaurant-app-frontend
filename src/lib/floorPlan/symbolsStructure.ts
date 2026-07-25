import type { SymbolDef, SymbolPrim } from './symbolPrims';

/**
 * Structure, seating and wayfinding symbols (FLOOR-PLAN-REVAMP §5.3). Strictly
 * top-down — a floor plan reads as a plan because walls, stairs, toilets and
 * counters are drawn from directly above. Ported verbatim from the prototype's
 * `SYM` so the shipped renderer matches the frozen reference.
 */

const line = (x1: number, y1: number, x2: number, y2: number, variant: SymbolPrim['variant']): SymbolPrim => ({
  tag: 'line',
  variant,
  x1,
  y1,
  x2,
  y2,
});

export const STRUCTURE_SYMBOLS: Record<string, SymbolDef> = {
  bar_counter: {
    name: 'Bar counter',
    w: 360,
    h: 70,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 360, height: 70, rx: 10 },
      line(10, 18, 350, 18, 'scenery'),
    ],
  },
  kitchen_pass: {
    name: 'Service pass',
    w: 200,
    h: 46,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 200, height: 46, rx: 4 },
      ...Array.from({ length: 6 }, (_, i) => line(20 + i * 32, 6, 8 + i * 32, 40, 'scenery')),
    ],
  },
  wc: {
    name: 'Toilet',
    w: 100,
    h: 132,
    prims: [
      { tag: 'rect', variant: 'faint', x: 2, y: 2, width: 96, height: 128, rx: 6 },
      { tag: 'rect', variant: 'sceneryFill', x: 26, y: 10, width: 48, height: 22, rx: 4 },
      {
        tag: 'path',
        variant: 'sceneryFill',
        d: 'M50 34 C74 34 82 58 82 78 C82 104 66 120 50 120 C34 120 18 104 18 78 C18 58 26 34 50 34 Z',
      },
      { tag: 'ellipse', variant: 'faint', cx: 50, cy: 80, rx: 20, ry: 30 },
      line(50, 32, 50, 40, 'scenery'),
    ],
  },
  stairs: {
    name: 'Stairs',
    w: 110,
    h: 220,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 110, height: 220, rx: 3 },
      ...Array.from({ length: 7 }, (_, i) => line(0, (i + 1) * 27.5, 110, (i + 1) * 27.5, 'faint')),
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 206, width: 110, height: 14 },
      { tag: 'path', variant: 'scenery', d: 'M55 196 V40 M40 58 L55 36 L70 58' },
    ],
  },
  column: {
    name: 'Column',
    w: 40,
    h: 40,
    prims: [{ tag: 'rect', variant: 'fill', x: 0, y: 0, width: 40, height: 40, rx: 3 }, line(6, 34, 34, 6, 'lnThin')],
  },
  // The doorway in a wall is drawn by the wall opening; this is a free-standing
  // door leaf + swing arc for a door that isn't set into a drawn wall.
  door_free: {
    name: 'Door',
    w: 88,
    h: 88,
    prims: [line(4, 84, 4, 4, 'ln'), { tag: 'path', variant: 'lnThin', d: 'M4 4 A 80 80 0 0 1 84 84' }],
  },
  divider: {
    name: 'Screen',
    w: 180,
    h: 40,
    prims: [{ tag: 'path', variant: 'scenery', d: 'M0 34 L45 6 L90 34 L135 6 L180 34' }],
  },
  rug: {
    name: 'Rug',
    w: 240,
    h: 160,
    prims: [
      { tag: 'rect', variant: 'faint', x: 0, y: 0, width: 240, height: 160, rx: 8 },
      { tag: 'rect', variant: 'faint', x: 16, y: 16, width: 208, height: 128, rx: 5 },
    ],
  },
  sofa: {
    name: 'Sofa',
    w: 200,
    h: 90,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 200, height: 90, rx: 12 },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 200, height: 24, rx: 10 },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 18, width: 22, height: 72, rx: 9 },
      { tag: 'rect', variant: 'sceneryFill', x: 178, y: 18, width: 22, height: 72, rx: 9 },
      line(100, 30, 100, 86, 'scenery'),
    ],
  },
  armchair: {
    name: 'Armchair',
    w: 92,
    h: 88,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 92, height: 88, rx: 12 },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 92, height: 22, rx: 10 },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 16, width: 20, height: 72, rx: 9 },
      { tag: 'rect', variant: 'sceneryFill', x: 72, y: 16, width: 20, height: 72, rx: 9 },
    ],
  },
  banquette: {
    name: 'Banquette',
    w: 300,
    h: 70,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 300, height: 70, rx: 8 },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 300, height: 18, rx: 7 },
      ...[75, 150, 225].map((x) => line(x, 22, x, 66, 'scenery')),
    ],
  },
  bar_stool: {
    name: 'Bar stool',
    w: 40,
    h: 40,
    prims: [{ tag: 'circle', variant: 'sceneryFill', cx: 20, cy: 20, r: 14 }],
  },
  // The entrance marker is only an arrow that says "come in here" — the door
  // leaf and swing belong to the wall opening (§4.4).
  entrance: {
    name: 'Entrance',
    w: 90,
    h: 60,
    prims: [{ tag: 'path', variant: 'ln', d: 'M4 30 h74 m-26 -22 l26 22 l-26 22' }, line(0, 6, 0, 54, 'lnThin')],
  },
};
