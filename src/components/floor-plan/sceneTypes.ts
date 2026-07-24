import type { SymbolVariant } from '@/lib/floorPlan/symbols';

/**
 * Shared types for the floor-plan scene layers. `SceneStyles` is the resolved
 * CSS-module class map (the VisualTableLayout `styles`-prop convention); the
 * structural module is shared and its class keys are named to match the symbol
 * variants and the tokens below, so a layer looks a class up by key.
 */
export type SceneStyles = Readonly<Record<string, string>>;

/**
 * How a table is drawn on the guest map. `available` is the only interactive
 * state on the admin preview; the guest map adds the rest (§4.2). Geometry never
 * depends on this — only the fill / opacity does — which is why the map and the
 * editor stay pixel-identical.
 */
export type TableRenderState = 'available' | 'selected' | 'booked' | 'small' | 'dim';

/** The class a symbol primitive's ink variant maps to (keys match the module). */
export const variantClass = (styles: SceneStyles, variant: SymbolVariant): string | undefined => styles[variant];
