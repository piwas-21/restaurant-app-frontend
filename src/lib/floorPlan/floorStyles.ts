/**
 * The floor finishes a room can be given (FLOOR-PLAN-REVAMP §4.3). The list is
 * the renderer's — {@link ../../components/floor-plan/RoomsLayer}'s pattern table
 * is what actually draws them — so offering a value it cannot draw would silently
 * fall back to wood and read as the picker being broken.
 *
 * The backend stores `FloorStyle` as free text (`varchar(40)`), so this vocabulary
 * is enforced by the editor rather than by a validator: an older plan carrying an
 * unknown value keeps it and renders on the fallback, instead of failing to save.
 */
export const FLOOR_STYLES = ['wood', 'tile', 'stone', 'carpet', 'deck'] as const;

export type FloorStyle = (typeof FLOOR_STYLES)[number];

/** The finish a new room lands with — the most common one in a restaurant. */
export const DEFAULT_FLOOR_STYLE: FloorStyle = 'wood';

/** Is this stored value one the picker can show as selected? */
export const isFloorStyle = (value: string | null | undefined): value is FloorStyle =>
  FLOOR_STYLES.includes(value as FloorStyle);
