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
  onToggle: (sectionId: string, itemId: string, productVariationId?: string | null) => void;
  onChange: (
    sectionId: string,
    itemId: string,
    patch: Partial<SelectedMenuOption>,
    productVariationId?: string | null,
  ) => void;
}

interface BundleSectionSelectorProps {
  section: MenuSection;
  selectedOptions: readonly SelectedMenuOption[];
  /** The section's unmet `minSelection`, present only once the guest has tried to add. */
  minSelectionError?: number;
  currentLanguage: string;
  onToggleOption: (section: MenuSection, itemId: string, productVariationId?: string | null) => void;
  onOptionQuantityChange?: (
    sectionId: string,
    itemId: string,
    quantity: number,
    productVariationId?: string | null,
  ) => void;
  /** Guest sheet raises a navigation intent for the option's customization screen. */
  onCustomizeOption?: (sectionId: string, itemId: string, productVariationId?: string | null) => void;
  /** STAFF modal: expand the option's editing panel inline instead of navigating. */
  inlinePanel?: BundleSectionInlinePanel;
  /** Guided flow supplies the visible section name; fieldset keeps its accessible name. */
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
  onOptionQuantityChange,
  onCustomizeOption,
  inlinePanel,
  hideLegend = false,
}: Readonly<BundleSectionSelectorProps>) {
  const { t } = useTranslation();

  const selectedCount = countSectionSelections(selectedOptions, section.id, section.allowRepeatedItems);
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
  const customizeProps = (item: (typeof section.items)[number]) => {
    const { productId: itemId, productVariationId } = item;
    if (inlinePanel) {
      const key = bundleOptionKey(section.id, itemId, productVariationId);
      const legacyBaseKey = `${section.id}::${itemId}`;
      return {
        onCustomize: () => {
          if (productVariationId == null) inlinePanel.onToggle(section.id, itemId);
          else inlinePanel.onToggle(section.id, itemId, productVariationId);
        },
        customizeExpanded:
          inlinePanel.expandedOptionKey === key ||
          (productVariationId == null && inlinePanel.expandedOptionKey === legacyBaseKey),
        customizePanelId: `bundle-option-panel-${key}`,
      };
    }
    return {
      onCustomize: () => {
        if (productVariationId == null) onCustomizeOption?.(section.id, itemId);
        else onCustomizeOption?.(section.id, itemId, productVariationId);
      },
    };
  };

  /** The row, then — staff mode only — the expanded panel under it. */
  const renderOption = (item: (typeof section.items)[number], extra: { hideSelectionControl?: boolean }) => {
    const option = findBundleOption(selectedOptions, section.id, item.productId, item.productVariationId);
    const isUnavailableForGuest = !inlinePanel && item.availability?.canOrder === false;
    const panelVisible = Boolean(
      inlinePanel &&
      (extra.hideSelectionControl ||
        inlinePanel.expandedOptionKey === bundleOptionKey(section.id, item.productId, item.productVariationId) ||
        (item.productVariationId == null && inlinePanel.expandedOptionKey === `${section.id}::${item.productId}`)),
    );
    const panelId = `bundle-option-panel-${bundleOptionKey(section.id, item.productId, item.productVariationId)}`;
    // A fixed Plat's Customize still NAVIGATES in the guest sheet; the staff modal keeps its panel
    // permanently open where the redundant radio picker used to be (P3), so it needs no Customize
    // affordance on top — every other selected option gets the navigation props.
    const navigateAffordance = customizeProps(item);
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
          isDisabled={!option && (isUnavailableForGuest || (!isRadio && selectedCount >= section.maxSelection))}
          selectedQuantity={section.allowRepeatedItems && option ? option.quantity : undefined}
          canIncreaseQuantity={selectedCount < section.maxSelection}
          onQuantityChange={
            onOptionQuantityChange &&
            ((quantity) => {
              if (quantity === 0) onToggleOption(section, item.productId, item.productVariationId);
              else onOptionQuantityChange(section.id, item.productId, quantity, item.productVariationId);
            })
          }
          showAvailabilityReason={isUnavailableForGuest}
          currentLanguage={currentLanguage}
          onToggle={() => {
            if (item.productVariationId == null) onToggleOption(section, item.productId);
            else onToggleOption(section, item.productId, item.productVariationId);
          }}
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
              item.productVariationId == null
                ? inlinePanel.onChange(section.id, item.productId, { selectedIngredients: selected })
                : inlinePanel.onChange(
                    section.id,
                    item.productId,
                    { selectedIngredients: selected },
                    item.productVariationId,
                  )
            }
            onQuantityChange={(ingredientId, quantity) =>
              item.productVariationId == null
                ? inlinePanel.onChange(section.id, item.productId, {
                    ingredientQuantities: { [ingredientId]: quantity },
                  })
                : inlinePanel.onChange(
                    section.id,
                    item.productId,
                    { ingredientQuantities: { [ingredientId]: quantity } },
                    item.productVariationId,
                  )
            }
            onInstructionsChange={(instructions) =>
              item.productVariationId == null
                ? inlinePanel.onChange(section.id, item.productId, { specialInstructions: instructions || undefined })
                : inlinePanel.onChange(
                    section.id,
                    item.productId,
                    { specialInstructions: instructions || undefined },
                    item.productVariationId,
                  )
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
      <section
        className={styles.section}
        aria-label={section.name}
        aria-describedby={minSelectionError !== undefined ? errorId : undefined}
      >
        {minSelectionError !== undefined && (
          <p className={styles.error} id={errorId} role="alert">
            {t('please_select_at_least_options', { count: minSelectionError })}
          </p>
        )}
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
