/**
 * Keep a translation that is a VERBATIM COPY of the item's own text in step with that text (#536).
 *
 * ## The defect
 *
 * `submitProductForm` copies the plain *Açıklama* / *Description* box into
 * `content[<the admin's current UI language>]` **on create only**. `submitEditProductForm` never
 * re-syncs it and builds `content` purely from the multilingual rows, and the backend does not
 * back-fill either (`UpdateProductCommand` writes `ProductDescription` rows solely from
 * `command.Content`). So a product created while the panel was in Turkish carries a Turkish
 * `content.tr.description` that silently OUTLIVES every later edit of the plain description field:
 * the admin edits *Açıklama*, saves, and a Turkish guest still reads the creation-time text.
 *
 * ## Why the obvious fix is wrong
 *
 * #536 offers "stop writing `content` from the plain box at all — one field, one meaning" as the
 * first alternative. **That would be a regression**, and the reason is in the READ chain rather
 * than in the write path. Every guest surface resolves
 *
 *     content[lang]?.description || content.en?.description || item.description
 *
 * (`localizedContent.ts:30`, `MenuCard.tsx:97`) — so `content.en` OUTRANKS the item's own field. For
 * a Turkish restaurant whose base text is Turkish, dropping the admin-language row means that the
 * moment anyone adds an English translation, every Turkish guest is served the ENGLISH description
 * instead of the Turkish original. The creation-time copy is what stops that today. Removing it is
 * only safe together with a change to the fallback chain, which is eleven read sites and a
 * guest-visible contract.
 *
 * ## What this does instead
 *
 * The second alternative, re-sync on edit — narrowed so that it needs no confirmation dialog. A row
 * is re-synced ONLY when its text is byte-identical (after trimming) to the base text being
 * REPLACED. That is the definition of a snapshot: a value nobody has edited since the copy was
 * made. A translation that has diverged by so much as a character is left alone, so nothing an
 * admin actually typed can be overwritten.
 *
 * The comparison is against the PREVIOUS base text, not the new one, which is why this needs the
 * fetched product and not just the form values.
 *
 * Name and description are treated alike. A stale `content.en.name` after a rename is the same
 * defect as a stale description — the English guest reads the old name — and the create path copies
 * both fields, so both can be snapshots.
 */

/** Absent, empty and whitespace-only are one state. */
const blank = (value: string | null | undefined): boolean => (value ?? '').trim().length === 0;

/**
 * Is `value` the untouched copy of `previous` that the create path wrote?
 *
 * Trimmed on both sides, because the create path copies the raw input while the edit path trims on
 * the way out, so a snapshot can differ from its source by whitespace alone after one round trip.
 *
 * A blank `previous` never matches anything: an item created with no description writes an empty
 * one into the row, and treating "" as a snapshot would let the FIRST description an admin writes
 * flood every locale that happens to carry an empty string.
 */
const isSnapshotOf = (value: string | null | undefined, previous: string | null | undefined): boolean =>
  !blank(previous) && (value ?? '').trim() === (previous ?? '').trim();

export interface ResyncRow {
  language?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface BaseTextChange {
  /** The name/description as LOADED — what a snapshot would still be equal to. */
  readonly previousName?: string | null;
  readonly previousDescription?: string | null;
  /** The name/description the admin is saving. */
  readonly nextName?: string | null;
  readonly nextDescription?: string | null;
}

/**
 * Rewrite each row's snapshot fields to the new base text, leaving every other value untouched.
 *
 * Returns the SAME rows when nothing is a snapshot, and never adds, removes or reorders a row: a
 * re-sync must not be able to create a translation that the admin never asked for. A locale with no
 * row keeps having no row, and falls back through the read chain exactly as before.
 */
export function withResyncedSnapshots<T extends ResyncRow>(
  rows: readonly T[] | null | undefined,
  change: BaseTextChange,
): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const nameChanged = !isSnapshotOf(change.nextName, change.previousName);
  const descriptionChanged = !isSnapshotOf(change.nextDescription, change.previousDescription);

  return rows.map((row) => {
    const name = nameChanged && isSnapshotOf(row.name, change.previousName) ? (change.nextName ?? '') : row.name;
    const description =
      descriptionChanged && isSnapshotOf(row.description, change.previousDescription)
        ? (change.nextDescription ?? '')
        : row.description;

    return name === row.name && description === row.description ? row : { ...row, name, description };
  });
}
