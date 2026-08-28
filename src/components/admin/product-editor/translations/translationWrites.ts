import type { ProductContentRow } from './translationSlots';
import { isBlank } from './translationSlots';

/**
 * The two writes the Translations workbench cannot express as a single `setValue` path
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN S4). Pure on purpose: both rebuild a value, neither touches
 * react-hook-form or React state, so the rules below are pinned by unit tests rather than inferred
 * from a rendered screen.
 */

/** What one language's row must satisfy to be worth keeping. */
const carriesText = (row: ProductContentRow): boolean => !isBlank(row.name) || !isBlank(row.description);

/**
 * Write one language's product name or description into `content`, the ARRAY of rows the product's
 * own schema takes (variations and ingredients use a keyed map instead — this asymmetry is the
 * data model's, not the workbench's).
 *
 * Two rules, and both are load-bearing:
 *
 * 1. **A row is created on demand and destroyed when it empties.** `contentSchema.name` is
 *    `min(1)`, so a row left behind with two blank fields is a resolver error the admin cannot see
 *    a cause for — they cleared a field and Save stopped working. Pruning is therefore part of the
 *    write, not a submit-time cleanup.
 * 2. **Order is preserved.** The rows are addressed by index in `errors.content[i]`, so shuffling
 *    them would move an error message onto another language's field.
 *
 * A name-less row that still has a description is KEPT, deliberately: it is text the admin typed,
 * the resolver names it (`Name is required for this language`), and the workbench renders that
 * message under the name it belongs to. Dropping it silently would delete their work to make a
 * message go away.
 */
export function nextProductContent(
  rows: readonly ProductContentRow[],
  locale: string,
  field: 'name' | 'description',
  value: string,
): ProductContentRow[] {
  const existing = rows.findIndex((row) => row.language === locale);
  const updated =
    existing === -1
      ? [...rows, { language: locale, name: '', description: '', [field]: value }]
      : rows.map((row, index) => (index === existing ? { ...row, [field]: value } : row));

  return updated.filter(carriesText);
}

/** The nested-map half of the same write: one locale's name on one ingredient. */
export function withIngredientTranslation<
  T extends { name?: string; content?: Record<string, { name: string; description?: string }> },
>(ingredient: T, locale: string, value: string): T {
  const previous = ingredient.content ?? {};
  return {
    ...ingredient,
    content: { ...previous, [locale]: { ...previous[locale], name: value } },
  };
}
