/**
 * Floor-plan symbol geometry as data (FLOOR-PLAN-REVAMP §5.3, ported from the
 * prototype's `SYM` renderer + `symbol-spec.html`). Each symbol is a list of
 * drawing primitives (rect / line / path / circle / ellipse) tagged with a
 * skin *variant* — the one thing the theme colours in. Keeping the geometry as
 * plain data (not SVG strings) means no `dangerouslySetInnerHTML`, unit tests
 * can assert the shapes, and craft/classic render the *same* geometry, differing
 * only in the class the renderer maps each variant to. Symbols are authored in
 * their own centimetre box (`w` × `h`); the scene scales them to the item's
 * metre footprint.
 *
 * Convention (symbol-spec.html): architecture is strictly top-down; decor may be
 * semi-pictorial. Every symbol works as a flat outline plus at most one fill.
 */

/** The ink role a primitive is drawn in — the renderer maps these to classes. */
export type SymbolVariant =
  | 'ln' // structural ink stroke, no fill
  | 'lnThin' // thin structural stroke
  | 'fill' // filled surface with an ink outline
  | 'scenery' // muted decor stroke, no fill
  | 'sceneryFill' // muted decor with a surface fill
  | 'scenerySolid' // muted decor as a solid fill, no stroke
  | 'faint'; // faint hairline (grain, floor lines)

export interface SymbolPrim {
  tag: 'rect' | 'line' | 'path' | 'circle' | 'ellipse';
  variant: SymbolVariant;
  d?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rx?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  r?: number;
  ry?: number;
  transform?: string;
}

/** A symbol: its human name, authoring box and the primitives that draw it. */
export interface SymbolDef {
  name: string;
  w: number;
  h: number;
  prims: SymbolPrim[];
}

const rad = (degrees: number): number => (degrees * Math.PI) / 180;
/** A point at polar (deg, r) from (cx, cy), rounded — for path `d` strings. */
const at = (cx: number, cy: number, degrees: number, r: number): string =>
  `${(cx + Math.cos(rad(degrees)) * r).toFixed(1)} ${(cy + Math.sin(rad(degrees)) * r).toFixed(1)}`;

/**
 * A bumpy organic crown (a top-down canopy / foliage clump) as one closed path.
 * `lobes` bumps around the ring; the radius wobbles deterministically so it
 * reads as leaves, not a circle.
 */
export function canopyPrim(
  cx: number,
  cy: number,
  r: number,
  lobes: number,
  phase = -90,
  variant: SymbolVariant = 'scenery',
): SymbolPrim {
  const step = 360 / lobes;
  const radius = (i: number): number => r * (1 + 0.17 * Math.sin(i * 2.31 + 0.7) + 0.07 * Math.cos(i * 4.7));
  let d = `M${at(cx, cy, phase, radius(0))}`;
  for (let i = 0; i < lobes; i++) {
    const a0 = phase + step * i;
    const rn = radius((i + 1) % lobes);
    d += ` Q ${at(cx, cy, a0 + step / 2, Math.max(radius(i), rn) * 1.3)} ${at(cx, cy, a0 + step, rn)}`;
  }
  return { tag: 'path', variant, d: `${d} Z` };
}

/**
 * A semi-pictorial potted plant — leaves fanning up out of a pot (a plant as the
 * eye knows it, not a top-down rosette that would read as a flower). Returns the
 * blades, their veins and the two-part pot.
 */
export function potPlantPrims(
  cx: number,
  baseY: number,
  potTopW: number,
  potH: number,
  leafLen: number,
  count: number,
  spread = 170,
): SymbolPrim[] {
  // All blades first, then all veins (as the prototype draws them) so a later
  // leaf never paints over an earlier leaf's vein, then the pot on top.
  const blades: SymbolPrim[] = [];
  const veins: SymbolPrim[] = [];
  const stemY = baseY + 2;
  for (let i = 0; i < count; i++) {
    const a = -90 - spread / 2 + (spread / (count - 1)) * i;
    const len = leafLen * (i % 2 ? 0.82 : 1);
    const tx = cx + Math.cos(rad(a)) * len;
    const ty = stemY + Math.sin(rad(a)) * len;
    const mx = cx + Math.cos(rad(a)) * len * 0.52;
    const my = stemY + Math.sin(rad(a)) * len * 0.52;
    const wx = Math.cos(rad(a + 90)) * len * 0.27;
    const wy = Math.sin(rad(a + 90)) * len * 0.27;
    blades.push({
      tag: 'path',
      variant: 'sceneryFill',
      d: `M${cx} ${stemY} Q ${(mx + wx).toFixed(1)} ${(my + wy).toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)} Q ${(mx - wx).toFixed(1)} ${(my - wy).toFixed(1)} ${cx} ${stemY} Z`,
    });
    veins.push({
      tag: 'path',
      variant: 'scenery',
      d: `M${cx} ${stemY} L${((cx + tx) / 2).toFixed(1)} ${((stemY + ty) / 2).toFixed(1)}`,
    });
  }
  const prims: SymbolPrim[] = [...blades, ...veins];
  const bW = potTopW * 0.76;
  prims.push({
    tag: 'path',
    variant: 'sceneryFill',
    d: `M${cx - potTopW / 2} ${baseY} L${cx + potTopW / 2} ${baseY} L${cx + bW / 2} ${baseY + potH} L${cx - bW / 2} ${baseY + potH} Z`,
  });
  prims.push({
    tag: 'path',
    variant: 'sceneryFill',
    d: `M${cx - potTopW / 2 - 3} ${baseY - 5} L${cx + potTopW / 2 + 3} ${baseY - 5} L${cx + potTopW / 2} ${baseY + 2} L${cx - potTopW / 2} ${baseY + 2} Z`,
  });
  return prims;
}
