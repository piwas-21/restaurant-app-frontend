/**
 * Wayfinding items — **zone regions, text labels and the entrance marker**
 * (FLOOR-PLAN-REVAMP §4.3). They are placed objects like a plant or a bar
 * counter, but each carries something a symbol does not: a zone carries a region
 * and a name, a text label carries its text, and the entrance carries a direction.
 *
 * Until S8 they were drawn but not grabbable — {@link ./symbols}.isMovableItemKind
 * excluded them — precisely because the editor had no affordance for what they
 * carry. This module is that affordance's vocabulary: which kinds they are, how
 * big they land, and which of them hold text.
 */

/** `zone`, the text labels, and `entrance` — kinds the symbol registry doesn't draw. */
export const WAYFINDING_KINDS = ['zone', 'text_label', 'label', 'entrance'] as const;

export type WayfindingKind = (typeof WAYFINDING_KINDS)[number];

export const isWayfindingKind = (kind: string): kind is WayfindingKind =>
  (WAYFINDING_KINDS as readonly string[]).includes(kind);

/**
 * `label` is the backend vocabulary's older spelling of `text_label`; both are
 * accepted and both draw as a tape tag, so the editor treats them as one kind
 * rather than offering two entries that do the same thing.
 */
export const isTextLabelKind = (kind: string): boolean => kind === 'text_label' || kind === 'label';

/** Which kinds carry user text at all — the panel shows a text field for these. */
export const carriesText = (kind: string): boolean => isTextLabelKind(kind) || kind === 'zone';

/**
 * `FloorPlanItemConfiguration` caps `Label` at 120 characters. Enforced on the
 * input so a name cannot be typed longer than the save would keep.
 */
export const MAX_ITEM_LABEL = 120;

/**
 * Footprints for the kinds with no authored symbol box to derive one from
 * ({@link ./palette}.defaultItemSize reads that box for everything else). A zone
 * lands big enough to hold a few tables; a tape label at the proportions the
 * renderer draws it at.
 */
export const WAYFINDING_SIZE_M: Readonly<Record<string, { widthMeters: number; heightMeters: number }>> = {
  zone: { widthMeters: 3, heightMeters: 2 },
  text_label: { widthMeters: 1.2, heightMeters: 0.34 },
  label: { widthMeters: 1.2, heightMeters: 0.34 },
};

/** The text a newly placed item starts with, so it is never an empty box. */
export const DEFAULT_ITEM_LABEL: Readonly<Record<string, string>> = {
  zone: 'Zone',
  text_label: 'Label',
  label: 'Label',
};
