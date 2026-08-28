/**
 * Every word a library picker renders, with the two catalogs side by side (plan S2/S3 for
 * ingredients, S4 for variations).
 *
 * ONE table, not one record per catalog. Every component below the modal is now shared, so the only
 * thing left that distinguishes an ingredient picker from a variation picker is which column of
 * this table it reads. Writing those two columns as two sibling records would have re-created the
 * duplicated block this extraction exists to remove — the property names would be identical and a
 * token-based detector does not read string literals.
 *
 * Every value is a literal, so each key is greppable from the word it renders, and adding a slot
 * forces both catalogs to answer for it.
 */
export type LibraryKind = 'ingredient' | 'variation';

const COPY = {
  /** The modal title. The ingredient picker predates the `<catalog>_library_*` convention. */
  title: { ingredient: 'add_from_library', variation: 'variation_library_title' },
  viewLabel: { ingredient: 'ingredient_library_view_label', variation: 'variation_library_view_label' },
  viewActive: { ingredient: 'ingredient_library_view_active', variation: 'variation_library_view_active' },
  viewArchived: { ingredient: 'ingredient_library_view_archived', variation: 'variation_library_view_archived' },
  archivedHint: { ingredient: 'ingredient_library_archived_hint', variation: 'variation_library_archived_hint' },
  archivedEmpty: { ingredient: 'ingredient_library_archived_empty', variation: 'variation_library_archived_empty' },
  searchLabel: { ingredient: 'ingredient_library_search_label', variation: 'variation_library_search_label' },
  searchPlaceholder: {
    ingredient: 'ingredient_library_search_placeholder',
    variation: 'variation_library_search_placeholder',
  },
  filterLabel: { ingredient: 'ingredient_library_filter_label', variation: 'variation_library_filter_label' },
  filterAll: { ingredient: 'ingredient_library_filter_all', variation: 'variation_library_filter_all' },
  filterNotAdded: {
    ingredient: 'ingredient_library_filter_not_added',
    variation: 'variation_library_filter_not_added',
  },
  filterTranslated: {
    ingredient: 'ingredient_library_filter_translated',
    variation: 'variation_library_filter_translated',
  },
  /** The left column header — the one slot whose key names the entity twice. */
  columnEntity: { ingredient: 'ingredient_library_column_ingredient', variation: 'variation_library_column_variation' },
  columnUsage: { ingredient: 'ingredient_library_column_usage', variation: 'variation_library_column_usage' },
  empty: { ingredient: 'ingredient_library_empty', variation: 'variation_library_empty' },
  retry: { ingredient: 'ingredient_library_retry', variation: 'variation_library_retry' },
  showing: { ingredient: 'ingredient_library_showing', variation: 'variation_library_showing' },
  languages: { ingredient: 'ingredient_library_languages', variation: 'variation_library_languages' },
  usedOn: { ingredient: 'ingredient_library_used_on', variation: 'variation_library_used_on' },
  archiveAction: { ingredient: 'ingredient_library_archive', variation: 'variation_library_archive' },
  deleteAction: { ingredient: 'ingredient_library_delete', variation: 'variation_library_delete' },
  archiveConfirm: { ingredient: 'ingredient_library_archive_confirm', variation: 'variation_library_archive_confirm' },
  deleteConfirm: { ingredient: 'ingredient_library_delete_confirm', variation: 'variation_library_delete_confirm' },
  restore: { ingredient: 'ingredient_library_restore', variation: 'variation_library_restore' },
  create: { ingredient: 'ingredient_library_create', variation: 'variation_library_create' },
  createNamed: { ingredient: 'ingredient_library_create_named', variation: 'variation_library_create_named' },
  createFailed: { ingredient: 'ingredient_library_create_failed', variation: 'variation_library_create_failed' },
  loadFailed: { ingredient: 'ingredient_library_load_failed', variation: 'variation_library_load_failed' },
} as const satisfies Record<string, Record<LibraryKind, string>>;

/** One catalog's column of the table: a translation key per slot. */
export type LibraryPickerCopy = Record<keyof typeof COPY, string>;

const forKind = (kind: LibraryKind): LibraryPickerCopy =>
  Object.fromEntries(Object.entries(COPY).map(([slot, keys]) => [slot, keys[kind]])) as LibraryPickerCopy;

/**
 * Built once at module load, so a picker passes a STABLE object down and no memo below it is
 * defeated by a fresh record on every render.
 */
export const INGREDIENT_LIBRARY_COPY = forKind('ingredient');
export const VARIATION_LIBRARY_COPY = forKind('variation');
