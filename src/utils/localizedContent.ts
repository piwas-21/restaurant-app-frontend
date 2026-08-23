/**
 * Locale resolution for a catalog item's display text.
 *
 * Several surfaces spell the same chain out by hand — the current locale's row, then the `en` row,
 * then the item's own plain field — and they had drifted: the browse card fell back to
 * `Product.Description` where the customization sheet stopped at `content.en`, so a card could show
 * a description the sheet then omitted (Track F/F3).
 *
 * `content` holds the per-locale rows the admin's multilingual-content editor writes; `name` and
 * `description` are the plain single-language fields written by the basic-info form.
 */
export interface LocalizedItem {
  name: string;
  description?: string;
  content?: Partial<Record<string, { name: string; description?: string }>>;
}

/** The item's display name in `language`, falling back to English and then to the plain name. */
export function localizedName(item: LocalizedItem, language: string): string {
  return item.content?.[language]?.name || item.content?.en?.name || item.name;
}

/**
 * The item's description in `language`, falling back to English and then to the plain description.
 *
 * Note this is the *display* chain, applied per surface. The card-level mapper deliberately does
 * NOT bake it in: there, a translation left blank on purpose must stay blank.
 */
export function localizedDescription(item: LocalizedItem, language: string): string | undefined {
  return item.content?.[language]?.description || item.content?.en?.description || item.description;
}
