'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BundleOptionRow from './BundleOptionRow';
import { bundleOptionKey, countSectionSelections, findBundleOption } from '@/utils/bundleSelection';
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
  const errorId = `bundle-section-error-${section.id}`;

  const selectionHint =
    section.minSelection === section.maxSelection
      ? `${t('choose')} ${section.maxSelection}`
      : `${t('choose')} ${section.minSelection}-${section.maxSelection}`;

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
        {selectedCount > 0 && ` (${selectedCount} ${t('selected')})`}
      </p>

      {minSelectionError !== undefined && (
        <p className={styles.error} id={errorId} role="alert">
          {`${t('please_select_at_least')} ${minSelectionError} ${t('options')}`}
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
