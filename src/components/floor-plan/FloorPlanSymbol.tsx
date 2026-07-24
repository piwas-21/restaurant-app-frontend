import type { SymbolDef, SymbolPrim } from '@/lib/floorPlan/symbols';
import { variantClass, type SceneStyles } from './sceneTypes';

/**
 * Renders one floor-plan symbol as SVG from its primitive list (no
 * `innerHTML` — every primitive is a real element so CSS-variable theming,
 * focus and `aria-*` work normally). The ink variant maps to a shared-module
 * class; all geometry comes from the pure symbol data, so both skins draw
 * identical shapes.
 */
function Primitive({ prim, styles }: Readonly<{ prim: SymbolPrim; styles: SceneStyles }>) {
  const className = variantClass(styles, prim.variant);
  switch (prim.tag) {
    case 'path':
      return <path className={className} d={prim.d} transform={prim.transform} />;
    case 'rect':
      return (
        <rect
          className={className}
          x={prim.x}
          y={prim.y}
          width={prim.width}
          height={prim.height}
          rx={prim.rx}
          transform={prim.transform}
        />
      );
    case 'line':
      return <line className={className} x1={prim.x1} y1={prim.y1} x2={prim.x2} y2={prim.y2} />;
    case 'circle':
      return <circle className={className} cx={prim.cx} cy={prim.cy} r={prim.r} />;
    case 'ellipse':
      return <ellipse className={className} cx={prim.cx} cy={prim.cy} rx={prim.rx} ry={prim.ry} />;
    default:
      return null;
  }
}

export default function FloorPlanSymbol({ def, styles }: Readonly<{ def: SymbolDef; styles: SceneStyles }>) {
  return (
    <>
      {def.prims.map((prim) => (
        <Primitive key={JSON.stringify(prim)} prim={prim} styles={styles} />
      ))}
    </>
  );
}
