'use client';

import React from 'react';
import BundleOptionRow from './BundleOptionRow';
import BundleOptionInlinePanel from './BundleOptionInlinePanel';
import { bundleOptionKey, findBundleOption } from '@/utils/bundleSelection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';

interface Props {
  section: MenuSection;
  item: MenuSection['items'][number];
  selectedOptions: readonly SelectedMenuOption[];
  selectedCount: number;
  isRadio: boolean;
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
  onCustomizeOption?: (
    sectionId: string,
    itemId: string,
    productVariationId?: string | null,
    menuSectionItemId?: string,
  ) => void;
  inlinePanel?: {
    expandedOptionKey: string | null;
    onToggle: (sectionId: string, itemId: string, variation?: string | null, menuSectionItemId?: string) => void;
    onChange: (
      sectionId: string,
      itemId: string,
      patch: Partial<SelectedMenuOption>,
      variation?: string | null,
      menuSectionItemId?: string,
    ) => void;
  };
  hideSelectionControl?: boolean;
}

export default function BundleSectionOption({
  section,
  item,
  selectedOptions,
  selectedCount,
  isRadio,
  currentLanguage,
  onToggleOption,
  onOptionQuantityChange,
  onCustomizeOption,
  inlinePanel,
  hideSelectionControl = false,
}: Props) {
  const option = findBundleOption(selectedOptions, section.id, item.productId, item.productVariationId, item.id);
  const unavailableForGuest = !inlinePanel && item.availability?.canOrder === false;
  const key = bundleOptionKey(section.id, item.productId, item.productVariationId, item.id);
  const legacyBaseKey = `${section.id}::${item.productId}`;
  const panelVisible = Boolean(
    inlinePanel &&
    (hideSelectionControl ||
      inlinePanel.expandedOptionKey === key ||
      (item.productVariationId == null && inlinePanel.expandedOptionKey === legacyBaseKey)),
  );
  const customize = inlinePanel
    ? {
        onCustomize: () => inlinePanel.onToggle(section.id, item.productId, item.productVariationId, item.id),
        customizeExpanded:
          inlinePanel.expandedOptionKey === key ||
          (item.productVariationId == null && inlinePanel.expandedOptionKey === legacyBaseKey),
        customizePanelId: `bundle-option-panel-${key}`,
      }
    : {
        onCustomize: () => onCustomizeOption?.(section.id, item.productId, item.productVariationId, item.id),
      };
  const customizeAffordance =
    hideSelectionControl && inlinePanel
      ? { onCustomize: undefined, customizeExpanded: undefined, customizePanelId: undefined }
      : customize;

  return (
    <>
      <BundleOptionRow
        item={item}
        sectionId={section.id}
        inputType={isRadio ? 'radio' : 'checkbox'}
        isSelected={Boolean(option)}
        isDisabled={!option && (unavailableForGuest || (!isRadio && selectedCount >= section.maxSelection))}
        selectedQuantity={section.allowRepeatedItems && option ? option.quantity : undefined}
        canIncreaseQuantity={selectedCount < section.maxSelection}
        onQuantityChange={
          onOptionQuantityChange &&
          ((quantity) => {
            if (quantity === 0) onToggleOption(section, item.productId, item.productVariationId, item.id);
            else onOptionQuantityChange(section.id, item.productId, quantity, item.productVariationId, item.id);
          })
        }
        showAvailabilityReason={unavailableForGuest}
        currentLanguage={currentLanguage}
        onToggle={() => onToggleOption(section, item.productId, item.productVariationId, item.id)}
        {...customizeAffordance}
        hideSelectionControl={hideSelectionControl}
      />
      {inlinePanel && panelVisible && (
        <BundleOptionInlinePanel
          id={`bundle-option-panel-${key}`}
          item={item}
          option={option}
          currentLanguage={currentLanguage}
          onSelectionChange={(selected) =>
            inlinePanel.onChange(section.id, item.productId, { selectedIngredients: selected }, undefined, item.id)
          }
          onQuantityChange={(ingredientId, quantity) =>
            inlinePanel.onChange(
              section.id,
              item.productId,
              { ingredientQuantities: { [ingredientId]: quantity } },
              undefined,
              item.id,
            )
          }
          onInstructionsChange={(instructions) =>
            inlinePanel.onChange(
              section.id,
              item.productId,
              { specialInstructions: instructions || undefined },
              undefined,
              item.id,
            )
          }
        />
      )}
    </>
  );
}
