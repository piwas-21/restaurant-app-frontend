'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IngredientKind } from '@/types/menu';
import styles from './GlobalIngredientPickerModal.module.css';

/**
 * @t-keys-table
 *
 * The marker `scripts/check-t-keys.mjs` looks for (issue #611) — every string below is a translation
 * key and no callsite quotes it, so without this comment the gate that stops a raw key reaching a
 * user cannot see any of them. Same reasoning, and same shape, as `libraryPickerCopy`.
 */
const SCOPE_COPY = {
  ingredient: {
    narrowed: 'ingredient_library_scope_ingredients_only',
    showOnly: 'ingredient_library_scope_show_ingredients',
  },
  sauce: {
    narrowed: 'ingredient_library_scope_sauces_only',
    showOnly: 'ingredient_library_scope_show_sauces',
  },
} as const satisfies Record<IngredientKind, { narrowed: string; showOnly: string }>;

interface LibraryKindScopeNoticeProps {
  /** The group the picker was opened from — what "only" means here. */
  kind: IngredientKind;
  /** Whether the catalog is currently narrowed to that group. */
  isScoped: boolean;
  /** How many rows the narrowing ALONE is hiding right now. */
  hiddenCount: number;
  onChange: (isScoped: boolean) => void;
}

/**
 * Says what the kind scope is hiding, and offers the way out of it (slice G2).
 *
 * **The affordance is the point, not the filter.** A Sauces picker that quietly showed only sauces
 * would, on a real tenant, open EMPTY — its library holds 654 rows, every one of them typed
 * `ingredient`, because until slice G1 no admin write ever sent a kind. An admin looking at that
 * cannot tell "your library has no sauces yet" from "this screen is broken", and either way has no
 * way to reach the row they know is in there. So the narrowing always says how many rows it is
 * holding back and always carries the button that reveals them.
 *
 * It renders NOTHING only when the scope is on and hiding nothing — there is no state to explain
 * and no rows to offer. When the scope is OFF it always renders, because that is the only control
 * that puts it back.
 *
 * `{{hidden}}` rather than `{{count}}`: i18next reads `count` as a plural selector and would need
 * `_one`/`_other` variants across ten bundles, four of which have plural rules English does not.
 * The sibling `ingredient_library_showing` avoids it the same way.
 */
export default function LibraryKindScopeNotice({
  kind,
  isScoped,
  hiddenCount,
  onChange,
}: Readonly<LibraryKindScopeNoticeProps>) {
  const { t } = useTranslation();

  if (isScoped && hiddenCount === 0) return null;

  const copy = SCOPE_COPY[kind];

  return (
    <p className={styles.scopeNotice}>
      {isScoped ? t(copy.narrowed, { hidden: hiddenCount }) : t('ingredient_library_scope_all')}
      <button type="button" className={styles.retryButton} onClick={() => onChange(!isScoped)}>
        {isScoped ? t('ingredient_library_scope_show_all') : t(copy.showOnly)}
      </button>
    </p>
  );
}
