/**
 * Mutually exclusive ingredients (SHARED-MODIFIERS-AND-SAUCES-PLAN §9, D13–D15).
 *
 * `ProductIngredient.exclusionGroup` is a per-product grouping KEY on the row — not a group entity,
 * because the ingredient id is what `OrderItem.IngredientQuantitiesJson` holds and a second table
 * would make those ids ambiguous (plan D8). Rows of one product sharing a non-empty key are
 * mutually exclusive: choosing one deselects the others, so at most one is ever on a line.
 *
 * **The widget stays a CHECKBOX, and that is a decision, not an omission (D15a).** A radio group has
 * no way back to "none": a checked radio fires no change event when clicked again — the very reason
 * `SauceGroupSection` needs an explicit "No sauce" answer. An exclusion group has no minimum, so the
 * guest must always be able to end with nothing selected, and Q7 rules out the titled group a "None"
 * row would need a heading for. A checkbox that unticks its siblings gives at-most-one AND zero.
 *
 * Enforcement is client-side by design (D14): a payload selecting two members is charged for both,
 * so it overpays rather than underpays. What the SERVER refuses is only the three shapes this
 * module could not render honestly — a group mixing kinds, a member the guest cannot remove, and
 * two members pre-selected by the base recipe (`IngredientExclusionGroupRule`).
 */

/**
 * The stored width of the key, mirroring `ProductIngredient.ExclusionGroupMaxLength` on the server
 * (one number, two layers). The admin input caps at it so a key that the API would refuse cannot be
 * typed in the first place.
 */
export const EXCLUSION_GROUP_MAX_LENGTH = 40;

/** The only fields the rule reads — satisfied by every ingredient shape in the app. */
export interface ExclusiveRow {
  id: string;
  exclusionGroup?: string | null;
}

/**
 * The stored key, read the way the server stores it: trimmed, and blank means NO GROUP.
 *
 * Both halves matter. The server normalises on write, so a blank can only arrive from a client that
 * built a row locally — and treating `''` as a key would put every such row in one anonymous group,
 * making unrelated ingredients exclude each other.
 */
export function exclusionGroupKey(row: ExclusiveRow | undefined): string | null {
  const trimmed = row?.exclusionGroup?.trim();
  return trimmed ? trimmed : null;
}

/**
 * The other rows in this row's group — the ones a selection must switch off.
 *
 * Empty for an ungrouped row, and empty for a group of ONE, which is the honest degrade: a lone
 * member has nothing to be exclusive with, so it behaves as an ordinary checkbox. The server
 * deliberately allows that state so an admin is not blocked halfway through building a group.
 */
export function exclusiveSiblingIds(rows: readonly ExclusiveRow[] | undefined, ingredientId: string): string[] {
  const target = (rows ?? []).find((row) => row.id === ingredientId);
  const key = exclusionGroupKey(target);
  if (key === null) return [];

  return (rows ?? []).filter((row) => row.id !== ingredientId && exclusionGroupKey(row) === key).map((row) => row.id);
}

/**
 * The ids that must be DESELECTED when `ingredientId` is selected: its group siblings that are
 * currently on the line.
 *
 * Narrowed to the ones actually selected so a caller can record the quantity-0 removal for exactly
 * those rows — the guest sheet's deselect convention, which is what makes the kitchen ticket print
 * "NO x" (the backend derives `IsRemoved` from a 0, issue #150). Returning every sibling instead
 * would write a 0 for rows that were never on the line.
 */
export function siblingsToDeselect(
  rows: readonly ExclusiveRow[] | undefined,
  ingredientId: string,
  selectedIngredientIds: Iterable<string>,
): string[] {
  const siblings = exclusiveSiblingIds(rows, ingredientId);
  if (siblings.length === 0) return [];

  const selected = selectedIngredientIds instanceof Set ? selectedIngredientIds : new Set(selectedIngredientIds);
  return siblings.filter((id) => selected.has(id));
}
