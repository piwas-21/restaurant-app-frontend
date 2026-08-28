'use client';

import React, { useState } from 'react';
import { Languages, Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TENANT_CURRENCY, formatPlainCurrency } from '@/utils/currency';
import type { ProductIngredient } from '@/types/menu';
import type { GlobalIngredientSummary } from '@/services/globalIngredientService';
import type { useGlobalIngredientSuggestions } from '@/hooks/admin/useGlobalIngredientSuggestions';
import Switch from '@/components/design-system/Switch';
import ProductIngredientDetails from './ProductIngredientDetails';
import RowMoveButtons from './RowMoveButtons';
import { INTEGER_INPUT_PROPS } from './numberInputProps';
import styles from './ProductIngredientRow.module.css';

/**
 * ONE recipe row, in the table shape of the approved Stitch screen
 * `docs/stitch-screens/admin-menu/recipe_dietary_details_split_view` — name, OPTIONAL, MAX QTY,
 * EXTRA PRICE, INCLUDED, delete.
 *
 * Extracted out of `ProductIngredientsManager` so the manager could become the GROUP component the
 * sauces split needs (plan D8) and still shrink. Two behaviours changed with the shape, both from
 * the design: every column is always visible (quantity, price and "included" used to appear only
 * once a row was ticked optional, so a non-optional row's stored price was invisible), and the
 * per-row price state is now the ROW's, not a `Record<number, string>` in the parent keyed by an
 * index that shifts whenever a row above it is deleted.
 *
 * Two deviations from the screen, both stated in the PR and in the plan:
 *  - the screen shows a globe glyph beside a translated name and no way to edit those names; the
 *    Translations tab that would own them is a later slice (MENU-ITEM-EDITOR-REDESIGN-PLAN D2), so
 *    the glyph is a TOGGLE that opens the existing per-locale inputs instead of a decoration;
 *  - the screen has no control for `isActive`, which is a shipped field the admin can still set
 *    today. Deleting the only control for it would strand the value, so it moves into that same
 *    detail panel rather than disappearing;
 *  - the screen draws a drag handle. Reordering is REAL as of #593 (slice S8) and the leading cell
 *    holds `Move up` / `Move down` instead — `RowMoveButtons`, shared with the variation table,
 *    states why buttons and not drag.
 */
interface ProductIngredientRowProps {
  ingredient: ProductIngredient;
  /** Index WITHIN the group, which is what the type-ahead hook keys its per-row state by. */
  index: number;
  productBasePrice: number;
  onPatch: (index: number, patch: Partial<ProductIngredient>) => void;
  onRemove: (index: number) => void;
  /** Swap this row with its neighbour inside the group. -1 up, +1 down. */
  onMove: (index: number, delta: -1 | 1) => void;
  /** Is there a row above / below this one in this group? Drives the buttons' `disabled`. */
  canMoveUp: boolean;
  canMoveDown: boolean;
  onContentChange: (index: number, language: string, value: string) => void;
  typeahead: ReturnType<typeof useGlobalIngredientSuggestions>;
  onPickSuggestion: (index: number, suggestion: GlobalIngredientSummary) => void;
}

const displayPrice = (price: number) => (price === 0 ? '' : String(price).replace('.', ','));

export default function ProductIngredientRow({
  ingredient,
  index,
  productBasePrice,
  onPatch,
  onRemove,
  onMove,
  canMoveUp,
  canMoveDown,
  onContentChange,
  typeahead,
  onPickSuggestion,
}: Readonly<ProductIngredientRowProps>) {
  const { t } = useTranslation();
  const [priceInput, setPriceInput] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const detailId = `ingredient-detail-${ingredient.id}`;
  const quantity = ingredient.maxQuantity || 1;
  const setQuantity = (next: number) => onPatch(index, { maxQuantity: Math.max(1, next) });

  const commitPrice = (raw: string) => {
    const parsed = Number.parseFloat(raw.replace(',', '.'));
    const value = Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
    onPatch(index, { price: value });
    setPriceInput(value === 0 ? '' : String(value).replace('.', ','));
  };

  return (
    <>
      <tr className={styles.row}>
        <RowMoveButtons index={index} canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} />
        <td className={styles.nameCell}>
          <div className={styles.nameField}>
            <input
              type="text"
              value={ingredient.name}
              onChange={(event) => {
                onPatch(index, { name: event.target.value });
                typeahead.search(index, event.target.value);
              }}
              onFocus={() => {
                if (typeahead.suggestions[index]?.length > 0) typeahead.setVisibleFor(index, true);
              }}
              // Delayed so a click on a suggestion lands before the list is torn down.
              onBlur={() => setTimeout(() => typeahead.setVisibleFor(index, false), 200)}
              placeholder={t('ingredient_name_placeholder')}
              aria-label={t('ingredient_name_placeholder')}
              className={styles.nameInput}
            />
            <button
              type="button"
              className={styles.detailToggle}
              aria-expanded={isDetailOpen}
              aria-controls={detailId}
              aria-label={t('ingredient_row_details')}
              onClick={() => setIsDetailOpen((open) => !open)}
            >
              <Languages size={16} aria-hidden="true" />
            </button>
            {typeahead.loading[index] && <output className={styles.spinner}>…</output>}
            {typeahead.visible[index] && typeahead.suggestions[index]?.length > 0 && (
              <ul className={styles.suggestions}>
                {typeahead.suggestions[index].map((suggestion) => (
                  <li key={suggestion.id}>
                    <button
                      type="button"
                      className={styles.suggestionItem}
                      // Keeps the input from blurring before the click is delivered.
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => onPickSuggestion(index, suggestion)}
                    >
                      <span>{suggestion.defaultName}</span>
                      <span className={styles.suggestionHint}>
                        {t('ingredient_library_languages', { count: suggestion.translations.length })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </td>
        <td className={styles.centerCell}>
          {/* The design system's Switch (#586/#575), not a hand-painted one. `srOnlyLabel` because
              the OPTIONAL column header already names it — repeating the word on every row is noise
              the approved screen does not draw, and the name stays in the a11y tree. */}
          <Switch
            className={styles.rowSwitch}
            label={t('ingredient_is_optional')}
            srOnlyLabel
            checked={ingredient.isOptional}
            onChange={(event) => onPatch(index, { isOptional: event.target.checked })}
          />
        </td>
        <td className={styles.centerCell}>
          <div className={styles.stepper}>
            <button type="button" aria-label={t('decrease_quantity')} onClick={() => setQuantity(quantity - 1)}>
              <Minus size={14} aria-hidden="true" />
            </button>
            {/* The shared count convention (S8), with the floor raised: `INTEGER_INPUT_PROPS` says
                `min="0"` and a max quantity of zero is not a row anyone can order, so `min` is
                overridden AFTER the spread — the same ordering rule the convention file states. */}
            <input
              {...INTEGER_INPUT_PROPS}
              min="1"
              value={quantity}
              aria-label={t('max_quantity')}
              onChange={(event) => setQuantity(Number.parseInt(event.target.value, 10) || 1)}
            />
            <button type="button" aria-label={t('increase_quantity')} onClick={() => setQuantity(quantity + 1)}>
              <Plus size={14} aria-hidden="true" />
            </button>
          </div>
        </td>
        <td className={styles.priceCell}>
          <div className={styles.priceField}>
            <span className={styles.currency}>{TENANT_CURRENCY}</span>
            {/* Deliberately NOT `MONEY_INPUT_PROPS`. This field accepts a comma as the decimal
                separator — every locale this admin ships in writes 1,50 — and `type="number"`
                would have the browser reject that keystroke before React ever sees it. It keeps
                `inputMode="decimal"`, which is the half of the convention a phone actually reads;
                the range the constant would add is enforced in `commitPrice` instead. */}
            <input
              type="text"
              inputMode="decimal"
              value={priceInput ?? displayPrice(ingredient.price)}
              aria-label={t('additional_price')}
              placeholder="0,00"
              onChange={(event) => {
                const raw = event.target.value;
                setPriceInput(raw);
                if (raw === '') {
                  onPatch(index, { price: 0 });
                  return;
                }
                const normalized = raw.replace('.', ',');
                // `\d*,?\d*` is ambiguous — "12" splits four ways, which is the backtracking
                // Sonar S8786 flags. A required comma inside the optional group is deterministic.
                if (!/^-?\d*(,\d*)?$/.test(normalized)) return;
                const parsed = Number.parseFloat(normalized.replace(',', '.'));
                if (!Number.isNaN(parsed)) onPatch(index, { price: parsed });
              }}
              onBlur={(event) => commitPrice(event.target.value)}
            />
          </div>
          {ingredient.price > 0 && (
            <span className={styles.pricePreview}>
              {t('customer_pays')}: {formatPlainCurrency(Number(productBasePrice || 0) + Number(ingredient.price || 0))}
            </span>
          )}
        </td>
        <td className={styles.centerCell}>
          <input
            type="checkbox"
            className={styles.includedBox}
            checked={ingredient.isIncludedInBasePrice || false}
            aria-label={t('ingredient_included_in_base_price')}
            onChange={(event) => onPatch(index, { isIncludedInBasePrice: event.target.checked })}
          />
        </td>
        <td className={styles.centerCell}>
          <button
            type="button"
            onClick={() => onRemove(index)}
            className={styles.removeButton}
            aria-label={t('remove_ingredient')}
          >
            <Trash2 size={16} aria-hidden="true" />
          </button>
        </td>
      </tr>
      {isDetailOpen && (
        <ProductIngredientDetails
          id={detailId}
          ingredient={ingredient}
          onPatch={(patch) => onPatch(index, patch)}
          onContentChange={(language, value) => onContentChange(index, language, value)}
        />
      )}
    </>
  );
}
