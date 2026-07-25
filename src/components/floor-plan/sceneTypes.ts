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

/**
 * How a table's selection was triggered. The guest map ignores this and just
 * picks the table; the admin editor needs it because a *pointer* press is
 * already handled by its gesture layer (which must not collapse a
 * multi-selection on the trailing click), while `Enter`/`Space` on a focused
 * table is the keyboard path and is the only one it should act on.
 */
export interface SelectTableSource {
  /** Shift was held — add to / remove from the selection rather than replace it. */
  additive?: boolean;
  viaKeyboard?: boolean;
  /**
   * No pointer produced this click (`MouseEvent.detail === 0`) — assistive tech,
   * voice control or `element.click()`. Such a click has no preceding
   * `pointerdown`, so a consumer that selects on pointer-down must honour it.
   */
  synthetic?: boolean;
}

export type SelectTable = (id: string, source?: SelectTableSource) => void;

/** The class a symbol primitive's ink variant maps to (keys match the module). */
export const variantClass = (styles: SceneStyles, variant: SymbolVariant): string | undefined => styles[variant];
