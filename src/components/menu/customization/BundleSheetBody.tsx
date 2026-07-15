'use client';

import React from 'react';
import BundleSectionSelector from './BundleSectionSelector';
import SpecialRequestSection from './SpecialRequestSection';
import type { useBundleCustomizationSheet } from '@/hooks/menu/useBundleCustomizationSheet';

export type BundleSheetController = ReturnType<typeof useBundleCustomizationSheet>;

/**
 * The bundle body of `ItemCustomizationSheet` — one selector per menu section, plus a bundle-level
 * special request (menu-bundles redesign #175, slice 6). Replaces `MenuCustomizationModal`.
 */
export default function BundleSheetBody({ controller }: Readonly<{ controller: BundleSheetController }>) {
  const {
    sections,
    selectedOptions,
    visibleErrors,
    expandedOptionKey,
    currentLanguage,
    toggleOption,
    toggleOptionExpanded,
    setOptionCustomization,
    specialInstructions,
    setSpecialInstructions,
  } = controller;

  const minSelectionBySection = new Map(visibleErrors.map((error) => [error.sectionId, error.minSelection]));

  return (
    <>
      {sections.map((section) => (
        <BundleSectionSelector
          key={section.id}
          section={section}
          selectedOptions={selectedOptions}
          minSelectionError={minSelectionBySection.get(section.id)}
          expandedOptionKey={expandedOptionKey}
          currentLanguage={currentLanguage}
          onToggleOption={toggleOption}
          onToggleExpanded={toggleOptionExpanded}
          onCustomizationChange={setOptionCustomization}
        />
      ))}

      <SpecialRequestSection specialInstructions={specialInstructions} onInstructionsChange={setSpecialInstructions} />
    </>
  );
}
