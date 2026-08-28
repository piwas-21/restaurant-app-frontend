'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Library, Plus } from 'lucide-react';
import type { IngredientKind, ProductIngredient } from '@/types/menu';
import type { GlobalIngredientSummary } from '@/services/globalIngredientService';
import { useGlobalIngredientSuggestions } from '@/hooks/admin/useGlobalIngredientSuggestions';
import { DEFAULT_INGREDIENT_KIND, ingredientsOfKind, mergeIngredientGroup } from '@/utils/ingredientKind';
import { moveIngredientInGroup } from '@/utils/ingredientOrder';
import { nextTemporaryIngredientId, withLibraryProvenance } from './globalIngredientLibrary';
import ProductIngredientRow from './ProductIngredientRow';
import styles from './IngredientGroup.module.css';

/**
 * Code-split, and mounted only while it is open.
 *
 * Statically imported, the picker (plus its row, its hook and the library helpers) put the two
 * menu-item editor routes 11% over their First Load JS baseline — the budget gate refused it, and
 * rightly: an admin who never opens the library was paying for it on every editor page load.
 * `next/dynamic` starts the fetch when the component first RENDERS, so the `isPickerOpen &&` guard
 * below is load-bearing, not cosmetic: rendering it closed would download the chunk anyway.
 */
const GlobalIngredientPickerModal = dynamic(() => import('./GlobalIngredientPickerModal'), { ssr: false });

interface ProductIngredientsManagerProps {
  /** EVERY row the product holds — both kinds. See the merge note below. */
  ingredients: ProductIngredient[];
  /** Receives every row the product holds, this group's edits merged back in place. */
  onChange: (ingredients: ProductIngredient[]) => void;
  productBasePrice: number;
  /** Which group this instance IS. Defaults to `'ingredient'` (plan D8). */
  kind?: IngredientKind;
  /** Rendered above the table — the sauce group's three rules live here. */
  children?: React.ReactNode;
}

/**
 * ONE labelled recipe group — Ingredients or Sauces (plan D8, §4; Stitch:
 * `recipe_dietary_details_split_view`).
 *
 * **It is a view, not a state.** The product has ONE `detailedIngredients` array: that is what the
 * payload carries, and the ids inside it are what `OrderItem.IngredientQuantitiesJson` references.
 * So this component receives every row, renders the ones of its own kind, and merges its slice back
 * through `mergeIngredientGroup` — rows of the other kind keep their position and every field,
 * including the ones no control on this screen renders. Splitting the state instead would mean
 * re-deriving one array from two on every save, which is the version that loses a row.
 *
 * It used to be the whole ingredients UI at 327 LOC; the row moved to `ProductIngredientRow` so
 * that the split could be a second instance of this component rather than a second implementation.
 */
export function ProductIngredientsManager({
  ingredients,
  onChange,
  productBasePrice,
  kind = DEFAULT_INGREDIENT_KIND,
  children,
}: Readonly<ProductIngredientsManagerProps>) {
  const { t } = useTranslation();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const typeahead = useGlobalIngredientSuggestions();

  const isSauceGroup = kind === 'sauce';
  const titleId = `recipe-group-${kind}`;
  const rows = useMemo(() => ingredientsOfKind(ingredients, kind), [ingredients, kind]);

  /** This group's slice, put back into the product's one array. */
  const commit = (nextGroup: ProductIngredient[]) => onChange(mergeIngredientGroup(ingredients, kind, nextGroup));

  const addRow = () => {
    commit([
      ...rows,
      {
        // Stripped before the payload leaves; shared with the picker so the two cannot collide.
        id: nextTemporaryIngredientId(),
        name: '',
        kind,
        isOptional: false,
        maxQuantity: 1,
        price: 0,
        isActive: true,
        // Across BOTH groups: two rows of different kinds must not claim one position.
        displayOrder: ingredients.length,
        content: {},
      },
    ]);
  };

  const patchRow = (index: number, patch: Partial<ProductIngredient>) =>
    commit(rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  /**
   * Reordering (#593). It goes through the WHOLE array rather than through `commit`, because the
   * move renumbers `displayOrder` across both kinds — see `ingredientOrder.ts`. An impossible move
   * returns the same array reference, so committing unconditionally cannot invent a dirty state.
   */
  const moveRow = (index: number, delta: -1 | 1) => onChange(moveIngredientInGroup(ingredients, kind, index, delta));

  const pickSuggestion = (index: number, suggestion: GlobalIngredientSummary) => {
    commit(rows.map((row, position) => (position === index ? withLibraryProvenance(row, suggestion) : row)));
    typeahead.setVisibleFor(index, false);
  };

  return (
    <section className={styles.group} aria-labelledby={titleId}>
      <h3 className={styles.title} id={titleId}>
        {t(isSauceGroup ? 'sauces' : 'ingredients')}
      </h3>

      {children}

      {isPickerOpen && (
        <GlobalIngredientPickerModal
          isOpen
          onClose={() => setIsPickerOpen(false)}
          // Every row, so a name already used as an ingredient is not offered again as a sauce.
          attached={ingredients}
          kind={kind}
          onAdd={(picked) => onChange([...ingredients, ...picked])}
        />
      )}

      {rows.length === 0 ? (
        <p className={styles.emptyState}>{t(isSauceGroup ? 'no_sauces_added' : 'no_ingredients_added')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {/* The reorder column's header is empty by design: `Move up`/`Move down` are on the
                  buttons themselves, and a visible column title for two chevrons is noise. */}
              <th />
              <th scope="col">{t('name')}</th>
              <th scope="col">{t('ingredient_optional')}</th>
              <th scope="col">{t('max_quantity')}</th>
              <th scope="col">{t('additional_price')}</th>
              <th scope="col">{t('ingredient_included')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((ingredient, index) => (
              <ProductIngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                index={index}
                productBasePrice={productBasePrice}
                onPatch={patchRow}
                onRemove={(position) => commit(rows.filter((_, other) => other !== position))}
                onMove={moveRow}
                canMoveUp={index > 0}
                canMoveDown={index < rows.length - 1}
                typeahead={typeahead}
                onPickSuggestion={pickSuggestion}
              />
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.actions}>
        <button type="button" onClick={() => setIsPickerOpen(true)} className={styles.libraryButton}>
          <Library size={16} aria-hidden="true" />
          {t('add_from_library')}
        </button>
        <button type="button" onClick={addRow} className={styles.addButton}>
          <Plus size={16} aria-hidden="true" />
          {t('add_manually')}
        </button>
      </div>
    </section>
  );
}
