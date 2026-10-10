'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import CustomizationGroupSection from './CustomizationGroupSection';
import IngredientStepsBody from './IngredientStepsBody';
import VariationsSection from './VariationsSection';
import SuggestedSideItemsSection from './SuggestedSideItemsSection';
import SpecialRequestSection from './SpecialRequestSection';
import { activeCustomizationGroups } from '@/utils/explicitCustomization';
import { findBundleOption } from '@/utils/bundleSelection';
import type { CustomizationStep } from '@/utils/customizationSteps';
import type { BundleSheetController } from './BundleSheetBody';
import type { SuggestedSideItem } from '@/types/menu';

interface Props {
  controller: BundleSheetController;
  step: CustomizationStep;
  onChoice: () => void;
}

/** Renders a selected bundle component's authored preparation screen using its exact row identity. */
export default function BundleComponentStepBody({ controller, step, onChoice }: Readonly<Props>) {
  const { i18n } = useTranslation();
  const item = step.component;
  const sectionItemId = step.sectionItemId;
  if (!item || !sectionItemId) return null;
  const selected = findBundleOption(
    controller.selectedOptions,
    itemSectionId(controller.sections, sectionItemId),
    item.productId,
    item.productVariationId,
    sectionItemId,
  );
  if (!selected) return null;

  const sectionId = selected.sectionId;
  const patch = (value: Parameters<typeof controller.setOptionCustomization>[2]) =>
    controller.setOptionCustomization(sectionId, item.productId, value, item.productVariationId, sectionItemId);
  const selectedIngredients = selected.selectedIngredients ?? [];
  const quantities = selected.ingredientQuantities ?? {};
  const setIngredientSelection = (ids: string[]) => patch({ selectedIngredients: ids });
  const setIngredientQuantity = (id: string, quantity: number) =>
    patch({ ingredientQuantities: { ...quantities, [id]: quantity } });
  const language = (i18n.language || 'en').split('-')[0];

  if (step.kind === 'variations') {
    const itemVariations = item.variations ?? [];
    if (item.productVariationId || itemVariations.length === 0) return null;
    const variations = itemVariations.filter(
      (variation) => !step.variationIds?.length || step.variationIds.includes(variation.id),
    );
    return (
      <VariationsSection
        variations={variations}
        selectedVariationId={selected.componentProductVariationId ?? null}
        onVariationChange={(id) => {
          const variation = variations.find((candidate) => candidate.id === id);
          patch({
            componentProductVariationId: id,
            componentProductVariationPriceModifier: variation?.priceModifier ?? null,
          });
          onChoice();
        }}
        basePrice={item.additionalPrice}
        currentLanguage={language}
        productName={item.productName ?? ''}
        hideBaseProduct={item.hideBaseProduct}
        headless
        radioName={`component-variation-${sectionItemId}`}
      />
    );
  }

  if (step.kind === 'ingredients' || step.kind === 'sauces') {
    return (
      <IngredientStepsBody
        sauceGroup={item}
        ingredients={(item.detailedIngredients ?? []).filter(
          (ingredient) => !step.ingredientIds?.length || step.ingredientIds.includes(ingredient.id),
        )}
        step={step}
        selectedIngredients={selectedIngredients}
        ingredientQuantities={quantities}
        onSelectionChange={setIngredientSelection}
        onQuantityChange={setIngredientQuantity}
        onChoice={onChoice}
        currentLanguage={language}
      />
    );
  }

  if (step.kind === 'group' && (step.groups?.length || step.group)) {
    const groups = step.groups ?? (step.group ? [step.group] : []);
    const allGroups = activeCustomizationGroups(item);
    return (
      <>
        {groups.map((group) => (
          <CustomizationGroupSection
            key={group.id}
            group={group}
            groups={allGroups}
            ingredients={item.detailedIngredients ?? []}
            selections={selected.customizationSelections ?? []}
            onSelectionsChange={(selections) => patch({ customizationSelections: selections })}
            onIngredientSelectionChange={(ids) => patch({ selectedIngredients: ids })}
            onIngredientQuantityChange={setIngredientQuantity}
            onChoice={onChoice}
            currentLanguage={language}
          />
        ))}
      </>
    );
  }

  if (step.kind === 'sides') {
    const sides: SuggestedSideItem[] = (item.suggestedSideItems ?? [])
      .filter((side) => !step.sideItemIds?.length || step.sideItemIds.includes(side.id))
      .map((side) => ({
        id: side.sideItemProductId,
        suggestedSideItemId: side.id,
        name: side.sideItemProductName ?? '',
        price: side.sideItemBasePrice,
        isRequired: side.isRequired,
        displayOrder: side.displayOrder,
        type: side.sideItemProductType,
        availability: side.availability,
        variations: side.variations,
      }));
    return (
      <SuggestedSideItemsSection
        sideItems={sides}
        selectedSideItems={selected.selectedSideItems ?? []}
        onSelectionChange={(selectedSideItems) => patch({ selectedSideItems })}
        currentLanguage={language}
        variant="bare"
      />
    );
  }

  if (step.kind === 'special') {
    return (
      <SpecialRequestSection
        specialInstructions={selected.specialInstructions ?? ''}
        onInstructionsChange={(specialInstructions) => patch({ specialInstructions })}
      />
    );
  }

  return null;
}

function itemSectionId(sections: BundleSheetController['sections'], sectionItemId: string): string {
  return sections.find((section) => section.items.some((item) => item.id === sectionItemId))?.id ?? '';
}
