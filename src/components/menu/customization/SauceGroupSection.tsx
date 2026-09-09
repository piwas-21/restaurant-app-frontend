'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import StatusBadge from '@/components/design-system/StatusBadge';
import {
  chargeableSauceUnits,
  isSauce,
  isSauceGroupFull,
  rendersNoSauceAnswer,
  saucesToDeselectForNoneOption,
  sauceWidget,
  waivedSauceUnits,
} from '@/utils/sauceGroup';
import { groupHint, groupSummary } from './stepLabel';
import { siblingsToDeselect } from '@/utils/exclusionGroup';
import type { ProductIngredient, SauceGroupRule } from '@/types/menu';
import styles from './SauceGroupSection.module.css';

interface SauceGroupSectionProps {
  /** The product's whole ingredient list — the sauces are picked out here, in one place. */
  ingredients: ProductIngredient[];
  rule: SauceGroupRule;
  selectedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  onSelectionChange: (selected: string[]) => void;
  onQuantityChange: (ingredientId: string, quantity: number) => void;
  currentLanguage: string;
  /**
   * `disclosure` (default) is the collapsed group the scrolling sheet needs. `plain` is the guided
   * flow's own step: already the only thing on screen, so it renders open with no header to press
   * and no summary line — the panel's heading says what this is.
   */
  variant?: 'disclosure' | 'plain';
}

/**
 * The guest sauces group (SHARED-MODIFIERS-AND-SAUCES-PLAN S6, D11/D12).
 *
 * Mounted INSIDE `OptionalIngredientsSection`, not beside it, so a bundle option inherits it for
 * free — `BundleOptionRow` mounts that section directly.
 *
 * Three things about it are decisions, not taste:
 *  - **Collapsed by default in `disclosure`** — the 390px sheet is already full, and a fifth block
 *    expanded on open would push "Add" below the fold. The per-option guided screen mounts `plain`
 *    on purpose: it is a step of its own, so the fold trade never applied there.
 *  - **The widget is DERIVED** from the rule (`max === 1` ⇒ radio, else checkboxes) and never
 *    chosen by an admin. The exclusive "no sauce" answer sorts FIRST — a deliberate 2026-09 owner
 *    override of the sort-last rule (GOV.UK's "the disruptive answer goes last"): guests reach for
 *    the leading row, and the owner wants the opt-out visible before the upsell, on products and
 *    bundle options alike. It stays exclusive and never max-blocked — it is the way OUT.
 *  - **It computes no money.** Every price it shows is read from the SAME `waivedSauceUnits`
 *    allocation `linePrice` subtracts — the backend's single writer mirrored — so a badge here can
 *    never claim a waiver the total did not apply.
 */

export default function SauceGroupSection({
  ingredients,
  rule,
  selectedIngredients,
  ingredientQuantities,
  onSelectionChange,
  onQuantityChange,
  currentLanguage,
  variant = 'disclosure',
}: Readonly<SauceGroupSectionProps>) {
  const { t } = useTranslation();
  const isPlain = variant === 'plain';
  const [isOpen, setIsOpen] = useState(false);
  const isExpanded = isPlain || isOpen;
  const domId = useId();

  const sauces = ingredients
    .filter((ingredient) => isSauce(ingredient) && ingredient.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // No sauces, no group, no summary, no empty state — as the ingredient section does.
  if (sauces.length === 0) return null;

  const choosable = sauces.filter((sauce) => sauce.isOptional);
  const selectedCount = choosable.filter((sauce) => selectedIngredients.includes(sauce.id)).length;
  const isFull = isSauceGroupFull(selectedCount, rule);
  const widget = sauceWidget(rule);

  // The one allocation. Money and badge read the same map (see the file comment).
  const waived = waivedSauceUnits(sauces, selectedIngredients, ingredientQuantities, rule.includedFree);

  const name = (sauce: ProductIngredient) =>
    sauce.content?.[currentLanguage]?.name || sauce.content?.en?.name || sauce.name;

  /** Deselect exactly as the ingredient section does: quantity 0, so the kitchen ticket says "NO x". */
  const deselect = (ids: string[]) => {
    onSelectionChange(selectedIngredients.filter((id) => !ids.includes(id)));
    ids.forEach((id) => onQuantityChange(id, 0));
  };

  const toggle = (sauce: ProductIngredient) => {
    if (!sauce.isOptional) return;
    if (selectedIngredients.includes(sauce.id)) {
      // Checkboxes only, in practice: a CHECKED radio fires no change event when clicked again, so
      // a single-choice group empties only through the "no sauce" answer, offered when min is 0.
      deselect([sauce.id]);
      return;
    }
    if (isFull && widget === 'checkbox') return;

    // The ids this selection switches off: every other choosable sauce in a single-choice group,
    // plus — whatever the widget — the row's own exclusion-group siblings (§9). A sauce may carry a
    // group key too (a group may not MIX kinds, plan Q9, but an all-sauce group is legal), and a key
    // that the sauces section ignored would be stored, shown in the editor and silently inert here.
    const others = widget === 'radio' ? choosable.map((other) => other.id) : [];
    const excluded = siblingsToDeselect(sauces, sauce.id, selectedIngredients);
    const noneExcluded = saucesToDeselectForNoneOption(ingredients, sauce.id, selectedIngredients);
    const cleared = [...new Set([...others, ...excluded, ...noneExcluded])];
    onSelectionChange([...selectedIngredients.filter((id) => !cleared.includes(id)), sauce.id]);
    cleared
      .filter((id) => id !== sauce.id && selectedIngredients.includes(id))
      .forEach((id) => onQuantityChange(id, 0));
    onQuantityChange(sauce.id, 1);
  };

  /** What the row says on its right-hand side — a badge or a price, never both. */
  const rowMarker = (sauce: ProductIngredient) => {
    const isSelected = selectedIngredients.includes(sauce.id);
    if (!sauce.isOptional) return <StatusBadge tone="success">{t('ingredient_included')}</StatusBadge>;

    if (isSelected) {
      const chargeable = chargeableSauceUnits(sauce, true, ingredientQuantities);
      const residual = (chargeable - (waived.get(sauce.id) ?? 0)) * sauce.price;
      if (chargeable > 0 && residual === 0) return <StatusBadge tone="success">{t('ingredient_included')}</StatusBadge>;
      return residual > 0 ? <span className={styles.price}>+{formatPlainCurrency(residual)}</span> : null;
    }

    if (isFull) return <StatusBadge tone="danger">{t('sauce_max_reached', { max: rule.max })}</StatusBadge>;
    if (sauce.price <= 0) return null;
    // Mirrors the ingredient rule: a sauce already paid for in the base price refunds when refused.
    return (
      <span className={styles.price}>
        {sauce.isIncludedInBasePrice ? '-' : '+'}
        {formatPlainCurrency(sauce.price)}
      </span>
    );
  };

  const hint = groupHint(t, rule);
  const summary = groupSummary(t, rule, selectedCount, choosable.length);

  return (
    <fieldset className={styles.group} aria-describedby={isExpanded && hint ? `${domId}-hint` : undefined}>
      {!isPlain && (
        <legend className={styles.legend}>
          <button
            type="button"
            className={styles.header}
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isExpanded}
            aria-controls={`${domId}-panel`}
          >
            <span className={styles.headerText}>
              <span className={styles.title}>{t('sauces')}</span>
              <span className={styles.summary}>{summary}</span>
            </span>
            {isExpanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
          </button>
        </legend>
      )}

      {isExpanded && (
        <div className={styles.panel} id={`${domId}-panel`}>
          {hint && (
            <p className={styles.hint} id={`${domId}-hint`}>
              {hint}
            </p>
          )}

          {/* FIRST, not last — the 2026-09 owner override recorded in the file header. Exclusive
              (checking it clears every choosable row) and never max-blocked: it is the way OUT of
              a full group, and it zeroes exactly the rows it removes, the stored no-sauce
              answers' rule. */}
          {rendersNoSauceAnswer(choosable.length, rule) && (
            <label className={`${styles.row} ${styles.rowExclusive}`}>
              <input
                type={widget}
                name={`${domId}-sauce`}
                className={styles.input}
                checked={selectedCount === 0}
                onChange={() =>
                  deselect(choosable.filter((sauce) => selectedIngredients.includes(sauce.id)).map((sauce) => sauce.id))
                }
              />
              <span className={styles.name}>{t('sauce_none')}</span>
            </label>
          )}

          {sauces.map((sauce) => {
            const isSelected = selectedIngredients.includes(sauce.id);
            // aria-disabled, never `disabled`: a blocked option must stay reachable and able to say WHY.
            const blocked = !sauce.isOptional || (!isSelected && isFull && widget === 'checkbox');
            return (
              <label key={sauce.id} className={`${styles.row} ${blocked ? styles.rowBlocked : ''}`}>
                <input
                  type={widget}
                  name={`${domId}-sauce`}
                  className={styles.input}
                  checked={isSelected}
                  aria-disabled={blocked || undefined}
                  onChange={() => toggle(sauce)}
                />
                {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
                <span dir="auto" className={styles.name}>
                  {name(sauce)}
                </span>
                {rowMarker(sauce)}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
