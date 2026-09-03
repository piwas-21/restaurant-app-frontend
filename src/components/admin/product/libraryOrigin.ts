/**
 * Who put the row on the shelf — the platform's own seed, or this tenant (backend D14).
 *
 * ADDITIVE and optional: a client reading a backend that predates the column gets `undefined`, and
 * every consumer here treats that as `'system'`, which is what all 704 seeded rows are and what the
 * migration's own default says. Erring that way is also the safe direction — an unknown row is
 * offered no destructive action rather than being offered a delete it should not have.
 */
export type LibraryOrigin = 'system' | 'custom';

/** What both catalog summaries carry. */
export interface WithOrigin {
  origin?: LibraryOrigin;
}

/**
 * The row's origin, with the pre-column default applied ONCE so no caller has to remember it.
 *
 * There is deliberately no `'unknown'`: a picker that had to render a third state would need words
 * for it, and the honest answer for a row from an older backend is the one the migration itself
 * gives every existing row.
 */
export function originOf(row: WithOrigin): LibraryOrigin {
  return row.origin === 'custom' ? 'custom' : 'system';
}

/**
 * May the admin REMOVE this row from the shelf?
 *
 * Only their own. A built-in can still be ARCHIVED — "we do not sell that" is a thing a tenant has
 * to be able to say about a shipped row — but the server refuses to delete one whatever this
 * answers (`DeleteGlobalVariationCommand` / `DeleteGlobalIngredientCommand`), so this is what the
 * picker uses to stop OFFERING a control the server would refuse, not a security boundary.
 */
export function isTenantOwned(row: WithOrigin): boolean {
  return originOf(row) === 'custom';
}
