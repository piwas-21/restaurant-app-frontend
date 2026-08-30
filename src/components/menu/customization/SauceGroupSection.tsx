'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import StatusBadge from '@/components/design-system/StatusBadge';
import { chargeableSauceUnits, isSauce, isSauceGroupFull, sauceWidget, waivedSauceUnits } from '@/utils/sauceGroup';
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
}

/**
 * The guest sauces group (SHARED-MODIFIERS-AND-SAUCES-PLAN S6, D11/D12).
 *
 * Mounted INSIDE `OptionalIngredientsSection`, not beside it, so a bundle option inherits it for
 * free — `BundleOptionRow` mounts that section directly.
 *
 * Three things about it are decisions, not taste:
 *  - **Collapsed by default.** The sheet is already full at 390px, which is why it carries no hero
 *    photo; a fifth block expanded on open would push "Add" below the fold.
 *  - **The widget is DERIVED** from the rule (`max === 1` ⇒ radio, else checkboxes) and never
 *    chosen by an admin, and the exclusive "no sauce" answer sorts LAST, after a rule (GOV.UK).
 *  - **It computes no money.** Every price it shows is read from the SAME `waivedSauceUnits`
 *    allocation `linePrice` subtracts, which mirrors the backend's single writer. A badge here can
 *    therefore never claim a waiver the total did not apply.
 */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * The group hint — the min/max stated as text under the legend, never as a tooltip (WCAG: a rule the
 * guest must satisfy has to be readable without hovering anything), plus what the allowance gives.
 */
function groupHint(t: Translate, rule: SauceGroupRule): string {
  const clauses: string[] = [];

  if (rule.max === null) {
    if (rule.min > 0) clauses.push(t('sauces_hint_at_least', { min: rule.min }));
  } else if (rule.min === rule.max) {
    clauses.push(t('sauces_hint_exactly', { amount: rule.max }));
  } else if (rule.min > 0) {
    clauses.push(t('sauces_hint_between', { min: rule.min, max: rule.max }));
  } else {
    clauses.push(t('sauces_hint_up_to', { max: rule.max }));
  }

  if (rule.includedFree === 1) clauses.push(t('sauces_hint_first_free'));
  else if (rule.includedFree > 1) clauses.push(t('sauces_hint_n_free', { amount: rule.includedFree }));

  return clauses.join(' ');
}

/** The collapsed one-liner: what the guest is choosing between, before they open anything. */
function groupSummary(t: Translate, rule: SauceGroupRule, selectedCount: number, available: number): string {
  if (selectedCount > 0) return t('sauces_summary_selected', { selected: selectedCount });
  return rule.includedFree > 0
    ? t('sauces_summary_free', { included: rule.includedFree, available })
    : t('sauces_summary_available', { available });
}

export default function SauceGroupSection({
  ingredients,
  rule,
  selectedIngredients,
  ingredientQuantities,
  onSelectionChange,
  onQuantityChange,
  currentLanguage,
}: Readonly<SauceGroupSectionProps>) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const domId = useId();

  const sauces = ingredients
    .filter((ingredient) => isSauce(ingredient) && ingredient.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  // A product with no sauces renders no group, no summary line and no empty state — exactly as the
  // ingredient section does with no ingredients.
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
      // Checkboxes only, in practice: a CHECKED radio fires no change event when it is clicked
      // again, which is why a single-choice group can be emptied only through the "no sauce"
      // answer — and why that answer is offered exactly when no sauce is required.
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
    const cleared = [...new Set([...others, ...excluded])];
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
      <legend className={styles.legend}>
        <button
          type="button"
          className={styles.header}
          onClick={() => setIsExpanded((open) => !open)}
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

      {isExpanded && (
        <div className={styles.panel} id={`${domId}-panel`}>
          {hint && (
            <p className={styles.hint} id={`${domId}-hint`}>
              {hint}
            </p>
          )}

          {sauces.map((sauce) => {
            const isSelected = selectedIngredients.includes(sauce.id);
            // aria-disabled, never `disabled`: a max-reached option must stay reachable and able to
            // say WHY it cannot be ticked, which a control removed from the tab order cannot.
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

          {rule.min === 0 && choosable.length > 0 && (
            <label className={`${styles.row} ${styles.rowExclusive}`}>
              <input
                type={widget}
                name={`${domId}-sauce`}
                className={styles.input}
                checked={selectedCount === 0}
                onChange={() => deselect(choosable.map((sauce) => sauce.id))}
              />
              <span className={styles.name}>{t('sauce_none')}</span>
            </label>
          )}
        </div>
      )}
    </fieldset>
  );
}
