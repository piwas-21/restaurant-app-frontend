import type { ProductSearchResult } from './types';
import type { SideItemDetails } from '@/hooks/admin/useSideItemDetails';

/**
 * The rules behind the side-item picker (MENU-ITEM-EDITOR-REDESIGN-PLAN **D12**, slice S9), kept
 * out of the modal that renders them.
 *
 * The surface this replaces could only ADD. `saveSelected` merged the ticked ids into the ones
 * already on the product (`Array.from(new Set([...selected, ...temp]))`), so unticking a row inside
 * the picker could not take an item off — the only way back out was the chip's `×` beside the
 * button. That is the gap D12 names, and merging is why it existed: **the picker now REPLACES the
 * set rather than merging into it**, which is what makes one tick box mean both directions.
 *
 * Everything here is a pure function over ids so the two directions can be proven without a render
 * and without a network. The same split the editor already uses for `translationSlots.ts` (§13.1):
 * anything that DECIDES belongs here, anything that fetches or draws belongs in the component.
 */

/** Tick or untick one row of the draft, preserving the order the rest were in. */
export function toggleSideItem(draft: readonly string[], id: string, checked: boolean): string[] {
  if (!checked) return draft.filter((entry) => entry !== id);
  return draft.includes(id) ? [...draft] : [...draft, id];
}

/**
 * An item may not be suggested with itself.
 *
 * Nothing on the server refuses it — `searchProducts` matches the product being edited like any
 * other row, and `UpdateProductCommand` would store the self-reference — so the guard has to be
 * here. It is stated once and consumed twice: the row renders un-tickable with the reason, and
 * `applySideItemDraft` strips the id anyway, so data that already carries one is repaired by the
 * next apply rather than being re-sent for ever.
 */
export function isSelfSuggestion(id: string, selfProductId?: string): boolean {
  return Boolean(selfProductId) && id === selfProductId;
}

/**
 * What the picker hands back to the form: the draft, de-duplicated, with the edited product itself
 * removed.
 *
 * De-duplication is not defensive tidying. `toggleSideItem` cannot produce a repeat, but the draft
 * is SEEDED from `suggestedSideItemIds` as the server sent it, and nothing in the schema
 * (`z.array(z.string())`) or in the backend command promises that list is a set.
 */
export function applySideItemDraft(draft: readonly string[], selfProductId?: string): string[] {
  const seen = new Set<string>();
  return draft.filter((id) => {
    if (isSelfSuggestion(id, selfProductId) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * Search results minus the rows the "currently suggested" group already shows.
 *
 * Two rows for one item would both be live (they share the draft) but would still read as two
 * things, and the second would silently answer for the first. The list of currently-suggested ids
 * is a SNAPSHOT taken when the picker opened, never the live draft: a row that vanished the moment
 * it was unticked could not be put back, which would make removal a one-way trip inside a dialog
 * that has a Cancel button.
 */
export function resultsNotAlreadyListed(
  results: readonly ProductSearchResult[],
  listedIds: readonly string[],
): ProductSearchResult[] {
  return results.filter((result) => !listedIds.includes(result.id));
}

/**
 * What to call a side item on screen.
 *
 * The fetched detail first, then the search result that is on screen anyway, then the id — the last
 * being the state `useSideItemDetails` reports an error for, so a chip reading `Item 3f2a9c11…`
 * always has an explanation beside it. Centralised because the chips and the modal must not drift
 * into naming the same item two different ways.
 */
export function sideItemLabel(
  id: string,
  details: ReadonlyMap<string, SideItemDetails>,
  results: readonly ProductSearchResult[] = [],
): string {
  return details.get(id)?.name ?? results.find((result) => result.id === id)?.name ?? `Item ${id.substring(0, 8)}...`;
}

/**
 * Would applying this draft change anything?
 *
 * The comparison is against the RAW current list, not against its cleaned form, so a product whose
 * stored list carries a duplicate or a self-reference still offers the repair. Without this the one
 * Save would unlock (`setValue(..., { shouldDirty: true })`) for a picker the admin opened and
 * closed, and an editor that reports unsaved changes it does not have teaches the admin to ignore
 * the warning.
 */
export function sideItemDraftChanged(
  current: readonly string[],
  draft: readonly string[],
  selfProductId?: string,
): boolean {
  const next = applySideItemDraft(draft, selfProductId);
  return next.length !== current.length || next.some((id, index) => id !== current[index]);
}
