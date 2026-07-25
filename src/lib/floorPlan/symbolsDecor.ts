import { canopyPrim, potPlantPrims, type SymbolDef, type SymbolPrim } from './symbolPrims';

/**
 * Decor symbols (FLOOR-PLAN-REVAMP §5.3). Decor is scenery whose orientation
 * carries no meaning, so it may be semi-pictorial (a plant as a pot with leaves,
 * not a top-down rosette) — but the tree stays a top-down crown and nothing here
 * is interactive. Ported from the prototype's `SYM`.
 */

const plant = (w: number, h: number, prims: SymbolPrim[]): SymbolDef => ({ name: 'Plant', w, h, prims });

const fireplaceHatch: SymbolPrim[] = [
  ...[0, 1, 2, 3].flatMap((i): SymbolPrim[] => [
    { tag: 'line', variant: 'faint', x1: 3, y1: 14 + i * 15, x2: 17, y2: 6 + i * 15 },
    { tag: 'line', variant: 'faint', x1: 133, y1: 14 + i * 15, x2: 147, y2: 6 + i * 15 },
  ]),
  ...[0, 1, 2, 3, 4, 5].map((i): SymbolPrim => ({
    tag: 'line',
    variant: 'faint',
    x1: 28 + i * 17,
    y1: 14,
    x2: 20 + i * 17,
    y2: 4,
  })),
];

const pianoKeys: SymbolPrim[] = Array.from({ length: 20 }, (_, k) => k + 1)
  .filter((i) => i % 7 !== 3 && i % 7 !== 0)
  .map((i): SymbolPrim => ({
    tag: 'rect',
    variant: 'scenerySolid',
    x: (i * 150) / 21 - 2,
    y: 0,
    width: 4,
    height: 16,
  }));

export const DECOR_SYMBOLS: Record<string, SymbolDef> = {
  plant_small: plant(62, 60, potPlantPrims(31, 42, 26, 18, 30, 5)),
  plant_large: plant(86, 84, potPlantPrims(43, 58, 34, 24, 42, 7)),
  // The generic `plant` kind renders as the small potted plant.
  plant: plant(62, 60, potPlantPrims(31, 42, 26, 18, 30, 5)),
  tree: {
    name: 'Tree',
    w: 120,
    h: 128,
    prims: [
      {
        tag: 'path',
        variant: 'sceneryFill',
        d: 'M52 128 C53 116 54 104 56 90 C57 83 63 83 64 90 C66 104 67 116 68 128 Z',
      },
      canopyPrim(60, 52, 45, 11, -90, 'sceneryFill'),
      ...(
        [
          [44, 44, 15],
          [74, 46, 14],
          [58, 64, 15],
          [72, 64, 11],
        ] as const
      ).map(([x, y, r], i) => canopyPrim(x, y, r, 7, -90 + i * 40, 'scenery')),
    ],
  },
  fireplace: {
    name: 'Fireplace',
    w: 150,
    h: 100,
    prims: [
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 150, height: 72, rx: 3 },
      ...fireplaceHatch,
      { tag: 'path', variant: 'sceneryFill', d: 'M22 72 L38 20 L112 20 L128 72 Z' },
      {
        tag: 'path',
        variant: 'scenery',
        d: 'M75 22 C64 34 70 44 68 52 C60 48 60 38 62 34 C54 42 52 56 62 64 C72 72 88 66 88 52 C88 40 78 36 75 22 Z',
      },
      { tag: 'rect', variant: 'scenery', x: 46, y: 58, width: 60, height: 10, rx: 5, transform: 'rotate(-17 76 63)' },
      { tag: 'rect', variant: 'scenery', x: 46, y: 58, width: 60, height: 10, rx: 5, transform: 'rotate(17 76 63)' },
      { tag: 'rect', variant: 'scenery', x: 8, y: 72, width: 134, height: 26, rx: 2 },
    ],
  },
  piano: {
    name: 'Grand piano',
    w: 150,
    h: 200,
    prims: [
      {
        tag: 'path',
        variant: 'sceneryFill',
        d: 'M0 30 L0 176 C0 194 10 200 28 200 C62 199 96 176 116 132 C134 92 146 56 150 30 Z',
      },
      {
        tag: 'path',
        variant: 'faint',
        d: 'M9 38 L9 174 C9 188 16 193 29 193 C58 192 90 171 109 130 C126 91 137 58 141 38 Z',
      },
      { tag: 'rect', variant: 'sceneryFill', x: 0, y: 0, width: 150, height: 30, rx: 2 },
      { tag: 'line', variant: 'scenery', x1: 0, y1: 22, x2: 150, y2: 22 },
      ...pianoKeys,
      { tag: 'rect', variant: 'faint', x: 28, y: 34, width: 94, height: 8, rx: 3 },
    ],
  },
};
