'use client';

import React from 'react';
import type { Control, FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form';
import type { ProductIngredient } from '@/types/menu';
import { ProductIngredientsManager } from './ProductIngredientsManager';
import SauceGroupRules from './SauceGroupRules';

/**
 * Section 5 — **Recipe & dietary** — split into its two labelled groups, Ingredients and Sauces
 * (SHARED-MODIFIERS-AND-SAUCES-PLAN D8/D9 §4; Stitch: `recipe_dietary_details_split_view`).
 *
 * The split is a VIEW. Both groups read and write the one `editor.detailedIngredients` array — the
 * only array the payload has, and the one whose ids past orders reference — so a row's group is
 * decided by its `kind` and nothing else. See `@/utils/ingredientKind` for the merge-back rule that
 * keeps a row of one kind untouched while the other kind is edited.
 *
 * The three sauce numbers are PRODUCT fields, not group state, so they are registered on the form
 * like any other column and rendered inside the group they describe.
 */
interface ProductRecipeGroupsProps {
  // readonly: S6759 — component props are never mutated.
  readonly ingredients: ProductIngredient[];
  readonly onChange: (ingredients: ProductIngredient[]) => void;
  readonly productBasePrice: number;
  readonly register: UseFormRegister<FieldValues>;
  readonly control: Control<FieldValues>;
  readonly errors: FieldErrors<FieldValues>;
}

export default function ProductRecipeGroups({
  ingredients,
  onChange,
  productBasePrice,
  register,
  control,
  errors,
}: ProductRecipeGroupsProps) {
  return (
    <>
      <ProductIngredientsManager
        kind="ingredient"
        ingredients={ingredients}
        onChange={onChange}
        productBasePrice={productBasePrice}
      />
      <ProductIngredientsManager
        kind="sauce"
        ingredients={ingredients}
        onChange={onChange}
        productBasePrice={productBasePrice}
      >
        <SauceGroupRules register={register} control={control} errors={errors} />
      </ProductIngredientsManager>
    </>
  );
}
