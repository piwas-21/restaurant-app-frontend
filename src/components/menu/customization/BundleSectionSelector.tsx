'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BundleSectionOption from './BundleSectionOption';
import { countSectionSelections } from '@/utils/bundleSelection';
import { isFixedPlatSection } from '@/utils/fixedPlatSection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';
import styles from './BundleSectionSelector.module.css';

/** Inline-expansion mode: the staff modal expands a selected option's panel under its row. */
export interface BundleSectionInlinePanel {
  expandedOptionKey: string | null;
  onToggle: (sectionId: string, itemId: string, productVariationId?: string | null, menuSectionItemId?: string) => void;
  onChange: (
    sectionId: string,
    itemId: string,
    patch: Partial<SelectedMenuOption>,
    productVariationId?: string | null,
    menuSectionItemId?: string,
  ) => void;
}

interface BundleSectionSelectorProps {
  section: MenuSection;
  selectedOptions: readonly SelectedMenuOption[];
  /** The section's unmet `minSelection`, present only once the guest has tried to add. */
  minSelectionError?: number;
  /** An old selection cannot be bound to a unique current row. */
  selectionRecovery?: boolean;
  onClearUnresolved?: () => void;
  currentLanguage: string;
  onToggleOption: (
    section: MenuSection,
    itemId: string,
    productVariationId?: string | null,
    menuSectionItemId?: string,
  ) => void;
  onOptionQuantityChange?: (
    sectionId: string,
    itemId: string,
    quantity: number,
    productVariationId?: string | null,
    menuSectionItemId?: string,
  ) => void;
  /** Guest sheet raises a navigation intent for the option's customization screen. */
  onCustomizeOption?: (
    sectionId: string,
    itemId: string,
    productVariationId?: string | null,
    menuSectionItemId?: string,
  ) => void;
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
  selectionRecovery = false,
  onClearUnresolved,
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
        <SelectionRecoveryNotice visible={selectionRecovery} onClear={onClearUnresolved} />
        {minSelectionError !== undefined && (
          <p className={styles.error} id={errorId} role="alert">
            {t('please_select_at_least_options', { count: minSelectionError })}
          </p>
        )}
        <BundleSectionOption
          section={section}
          item={item}
          selectedOptions={selectedOptions}
          selectedCount={selectedCount}
          isRadio={isRadio}
          currentLanguage={currentLanguage}
          onToggleOption={onToggleOption}
          onOptionQuantityChange={onOptionQuantityChange}
          onCustomizeOption={onCustomizeOption}
          inlinePanel={inlinePanel}
          hideSelectionControl
        />
      </section>
    );
  }

  return (
    <fieldset
      className={styles.section}
      aria-label={hideLegend ? section.name : undefined}
      aria-describedby={minSelectionError ? errorId : undefined}
    >
      <SelectionRecoveryNotice visible={selectionRecovery} onClear={onClearUnresolved} />
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

      <div className={styles.options}>
        {section.items.map((item) => (
          <BundleSectionOption
            key={item.id}
            section={section}
            item={item}
            selectedOptions={selectedOptions}
            selectedCount={selectedCount}
            isRadio={isRadio}
            currentLanguage={currentLanguage}
            onToggleOption={onToggleOption}
            onOptionQuantityChange={onOptionQuantityChange}
            onCustomizeOption={onCustomizeOption}
            inlinePanel={inlinePanel}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function SelectionRecoveryNotice({ visible, onClear }: { visible: boolean; onClear?: () => void }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div className={styles.recovery} role="alert">
      <p>{t('customer_selection_recover')}</p>
      {onClear && (
        <button type="button" className={styles.recoveryAction} onClick={onClear}>
          {t('customer_selection_clear')}
        </button>
      )}
    </div>
  );
}
