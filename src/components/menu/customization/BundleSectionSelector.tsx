'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BundleOptionRow from './BundleOptionRow';
import BundleOptionInlinePanel from './BundleOptionInlinePanel';
import { bundleOptionKey, countSectionSelections, findBundleOption } from '@/utils/bundleSelection';
import { isFixedPlatSection } from '@/utils/fixedPlatSection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';
import styles from './BundleSectionSelector.module.css';

/** Inline-expansion mode: the staff modal expands a selected option's panel under its row. */
export interface BundleSectionInlinePanel {
  expandedOptionKey: string | null;
  onToggle: (sectionId: string, itemId: string) => void;
  onChange: (sectionId: string, itemId: string, patch: Partial<SelectedMenuOption>) => void;
}

interface BundleSectionSelectorProps {
  section: MenuSection;
  selectedOptions: readonly SelectedMenuOption[];
  /** The section's unmet `minSelection`, present only once the guest has tried to add. */
  minSelectionError?: number;
  currentLanguage: string;
  onToggleOption: (section: MenuSection, itemId: string) => void;
  /**
   * GUEST sheet: tapping Customize on a selected option opens the option's guided customization
   * screen, which the sheet itself hosts (BundleOptionCustomizationScreen — the 2026-09 owner
   * decision superseding #175's inline drill-in). The selector only raises the intent.
   */
  onCustomizeOption?: (sectionId: string, itemId: string) => void;
  /** STAFF modal: expand the option's editing panel inline instead of navigating. */
  inlinePanel?: BundleSectionInlinePanel;
  /**
   * Withhold the visible `<legend>`. The guided flow's step panel already carries the section name
   * and its required marker; a second copy inside the fieldset reads as a nested group. The
   * fieldset keeps an `aria-label` in that case, so the grouping is still named for assistive tech.
   */
  hideLegend?: boolean;
}

/**
 * One bundle section ("Choose a drink") — its header, its selection rules, and its options
 * (menu-bundles redesign #175, slice 6). Single-choice sections render as a radio group, multi as a
 * checkbox group capped at `maxSelection`.
 */
export default function BundleSectionSelector({
  section,
  selectedOptions,
  minSelectionError,
  currentLanguage,
  onToggleOption,
  onCustomizeOption,
  inlinePanel,
  hideLegend = false,
}: Readonly<BundleSectionSelectorProps>) {
  const { t } = useTranslation();

  const selectedCount = countSectionSelections(selectedOptions, section.id);
  const isRadio = section.maxSelection === 1;
  const fixedPlat = isFixedPlatSection(section);
  const errorId = `bundle-section-error-${section.id}`;

  // Interpolated, not concatenated: word order varies by locale (tr renders the verb last —
  // "{{count}} adet seçin" — which `t('choose') + count` could never express).
  const selectionHint =
    section.minSelection === section.maxSelection
      ? t('choose_count', { count: section.maxSelection })
      : t('choose_range', { min: section.minSelection, max: section.maxSelection });

  /** What Customize opens for this option — navigation (guest) or inline disclosure (staff). */
  const customizeProps = (itemId: string) => {
    if (inlinePanel) {
      const key = bundleOptionKey(section.id, itemId);
      return {
        onCustomize: () => inlinePanel.onToggle(section.id, itemId),
        customizeExpanded: inlinePanel.expandedOptionKey === key,
        customizePanelId: `bundle-option-panel-${section.id}-${itemId}`,
      };
    }
    return { onCustomize: () => onCustomizeOption?.(section.id, itemId) };
  };

  /** The row, then — staff mode only — the expanded panel under it. */
  const renderOption = (item: (typeof section.items)[number], extra: { hideSelectionControl?: boolean }) => {
    const option = findBundleOption(selectedOptions, section.id, item.productId);
    const panelVisible = Boolean(
      inlinePanel &&
      (extra.hideSelectionControl || inlinePanel.expandedOptionKey === bundleOptionKey(section.id, item.productId)),
    );
    const panelId = `bundle-option-panel-${section.id}-${item.productId}`;
    // A fixed Plat's Customize still NAVIGATES in the guest sheet; the staff modal keeps its panel
    // permanently open where the redundant radio picker used to be (P3), so it needs no Customize
    // affordance on top — every other selected option gets the navigation props.
    const navigateAffordance = customizeProps(item.productId);
    let customizeAffordance:
      | typeof navigateAffordance
      | { onCustomize: undefined; customizeExpanded: undefined; customizePanelId: undefined } = navigateAffordance;
    if (extra.hideSelectionControl && inlinePanel) {
      customizeAffordance = { onCustomize: undefined, customizeExpanded: undefined, customizePanelId: undefined };
    }

    return (
      <React.Fragment key={item.id}>
        <BundleOptionRow
          item={item}
          sectionId={section.id}
          inputType={isRadio ? 'radio' : 'checkbox'}
          isSelected={Boolean(option)}
          isDisabled={!option && !isRadio && selectedCount >= section.maxSelection}
          currentLanguage={currentLanguage}
          onToggle={() => onToggleOption(section, item.productId)}
          {...customizeAffordance}
          {...extra}
        />
        {inlinePanel && panelVisible && (
          <BundleOptionInlinePanel
            id={panelId}
            item={item}
            option={option}
            currentLanguage={currentLanguage}
            onSelectionChange={(selected) =>
              inlinePanel.onChange(section.id, item.productId, { selectedIngredients: selected })
            }
            onQuantityChange={(ingredientId, quantity) =>
              inlinePanel.onChange(section.id, item.productId, { ingredientQuantities: { [ingredientId]: quantity } })
            }
            onInstructionsChange={(instructions) =>
              inlinePanel.onChange(section.id, item.productId, { specialInstructions: instructions || undefined })
            }
          />
        )}
      </React.Fragment>
    );
  };

  // P3: a required `Plat` with one legal item is already selected by the hook. Keep the child in
  // selectedMenuOptions, but move its customizations to where the redundant radio picker used to be.
  if (fixedPlat) {
    const item = section.items[0];

    return (
      <section className={styles.section} aria-label={section.name}>
        {renderOption(item, { hideSelectionControl: true })}
      </section>
    );
  }

  return (
    <fieldset
      className={styles.section}
      aria-label={hideLegend ? section.name : undefined}
      aria-describedby={minSelectionError ? errorId : undefined}
    >
      {!hideLegend && (
        <legend className={styles.legend}>
          <span className={styles.name}>
            {section.name}
            {section.isRequired && (
              <span className={styles.required} aria-label={t('required')}>
                *
              </span>
            )}
          </span>
        </legend>
      )}

      {section.description && <p className={styles.description}>{section.description}</p>}

      <p className={styles.hint}>
        {selectionHint}
        {selectedCount > 0 && ` ${t('selected_count', { count: selectedCount })}`}
      </p>

      {minSelectionError !== undefined && (
        <p className={styles.error} id={errorId} role="alert">
          {t('please_select_at_least_options', { count: minSelectionError })}
        </p>
      )}

      <div className={styles.options}>{section.items.map((item) => renderOption(item, {}))}</div>
    </fieldset>
  );
}
