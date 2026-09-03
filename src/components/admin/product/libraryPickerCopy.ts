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

/**
 * @t-keys-table
 *
 * The marker `scripts/check-t-keys.mjs` looks for (issue #611). Every string below is a translation
 * key, and no callsite quotes it — the pickers render `t(copy.title)` — so without this comment the
 * gate that exists to stop a raw key reaching a user cannot see any of them.
 *
 * It is deliberately a MARKER and not the filename: rename this module and the keys would leave the
 * gate silently, which is the exact failure #611 was filed about.
 */
const COPY = {
  /** The modal title. The ingredient picker predates the `<catalog>_library_*` convention. */
  title: { ingredient: 'add_from_library', variation: 'variation_library_title' },
  viewLabel: { ingredient: 'ingredient_library_view_label', variation: 'variation_library_view_label' },
  viewActive: { ingredient: 'ingredient_library_view_active', variation: 'variation_library_view_active' },
  viewMine: { ingredient: 'ingredient_library_view_mine', variation: 'variation_library_view_mine' },
  viewArchived: { ingredient: 'ingredient_library_view_archived', variation: 'variation_library_view_archived' },
  /**
   * The tenant's own shelf, empty — every tenant's starting state.
   *
   * It says "none of your own HERE", not "you have not created any": against a backend that
   * predates the `origin` column every row reads as a built-in, so the shelf would be asserting
   * something it cannot know. The weaker sentence is true either way and still points at the way to
   * add one.
   */
  mineEmpty: { ingredient: 'ingredient_library_mine_empty', variation: 'variation_library_mine_empty' },
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
  /** What "+ Create new" needs before it can create anything: a name in the search box. */
  createNeedsName: {
    ingredient: 'ingredient_library_create_needs_name',
    variation: 'variation_library_create_needs_name',
  },
  loadFailed: { ingredient: 'ingredient_library_load_failed', variation: 'variation_library_load_failed' },
  /* "Apply to items" — plan S8. Every value is still a LITERAL: the two catalogs' keys differ only
     by their prefix, and building them as `${prefix}_library_apply` would take all twenty-six out of
     this gate's sight, which is the exact failure #611 was filed about. */
  applyAction: { ingredient: 'ingredient_library_apply', variation: 'variation_library_apply' },
  applyTitle: { ingredient: 'ingredient_library_apply_title', variation: 'variation_library_apply_title' },
  applyLead: { ingredient: 'ingredient_library_apply_lead', variation: 'variation_library_apply_lead' },
  applyLoading: { ingredient: 'ingredient_library_apply_loading', variation: 'variation_library_apply_loading' },
  applyEmpty: { ingredient: 'ingredient_library_apply_empty', variation: 'variation_library_apply_empty' },
  applyUncategorised: {
    ingredient: 'ingredient_library_apply_uncategorised',
    variation: 'variation_library_apply_uncategorised',
  },
  /** The blast radius (D6): how many items the confirm is about to change. */
  applyConfirm: { ingredient: 'ingredient_library_apply_confirm', variation: 'variation_library_apply_confirm' },
  applyAlreadyHave: {
    ingredient: 'ingredient_library_apply_already_have',
    variation: 'variation_library_apply_already_have',
  },
  applyDone: { ingredient: 'ingredient_library_apply_done', variation: 'variation_library_apply_done' },
  applySkipped: { ingredient: 'ingredient_library_apply_skipped', variation: 'variation_library_apply_skipped' },
  applyFailed: { ingredient: 'ingredient_library_apply_failed', variation: 'variation_library_apply_failed' },
  applyLoadFailed: {
    ingredient: 'ingredient_library_apply_load_failed',
    variation: 'variation_library_apply_load_failed',
  },
  applyBack: { ingredient: 'ingredient_library_apply_back', variation: 'variation_library_apply_back' },
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
