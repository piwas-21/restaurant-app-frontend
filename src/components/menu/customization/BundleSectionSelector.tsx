'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BundleOptionRow from './BundleOptionRow';
import { bundleOptionKey, countSectionSelections, findBundleOption } from '@/utils/bundleSelection';
import { isFixedPlatSection } from '@/utils/fixedPlatSection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';
import styles from './BundleSectionSelector.module.css';

interface BundleSectionSelectorProps {
  section: MenuSection;
  selectedOptions: readonly SelectedMenuOption[];
  /** The section's unmet `minSelection`, present only once the guest has tried to add. */
  minSelectionError?: number;
  expandedOptionKey: string | null;
  currentLanguage: string;
  onToggleOption: (section: MenuSection, itemId: string) => void;
  onToggleExpanded: (sectionId: string, itemId: string) => void;
  onCustomizationChange: (sectionId: string, itemId: string, patch: Partial<SelectedMenuOption>) => void;
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
  expandedOptionKey,
  currentLanguage,
  onToggleOption,
  onToggleExpanded,
  onCustomizationChange,
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

  // P3: a required `Plat` with one legal item is already selected by the hook. Keep the child in
  // selectedMenuOptions, but show its customizations where the redundant radio picker used to be.
  if (fixedPlat) {
    const item = section.items[0];
    const option = findBundleOption(selectedOptions, section.id, item.productId);

    return (
      <section className={styles.section} aria-label={section.name}>
        <BundleOptionRow
          item={item}
          sectionId={section.id}
          inputType="radio"
          isSelected={Boolean(option)}
          isDisabled={false}
          isExpanded={true}
          option={option}
          currentLanguage={currentLanguage}
          onToggle={() => onToggleOption(section, item.productId)}
          onToggleExpanded={() => onToggleExpanded(section.id, item.productId)}
          onCustomizationChange={(patch) => onCustomizationChange(section.id, item.productId, patch)}
          hideSelectionControl
          showCustomizationInline
        />
      </section>
    );
  }

  return (
    <fieldset className={styles.section} aria-describedby={minSelectionError ? errorId : undefined}>
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
        {section.items.map((item) => {
          const option = findBundleOption(selectedOptions, section.id, item.productId);
          const isSelected = Boolean(option);

          return (
            <BundleOptionRow
              key={item.id}
              item={item}
              sectionId={section.id}
              inputType={isRadio ? 'radio' : 'checkbox'}
              isSelected={isSelected}
              isDisabled={!isSelected && !isRadio && selectedCount >= section.maxSelection}
              isExpanded={expandedOptionKey === bundleOptionKey(section.id, item.productId)}
              option={option}
              currentLanguage={currentLanguage}
              onToggle={() => onToggleOption(section, item.productId)}
              onToggleExpanded={() => onToggleExpanded(section.id, item.productId)}
              onCustomizationChange={(patch) => onCustomizationChange(section.id, item.productId, patch)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
