'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBaseRowHidden } from '@/utils/baseProductVisibility';
import type { Product } from '@/services/serverService';
import { useProductCustomizationDetails } from './useProductCustomizationDetails';
import type {
  CustomizationResult,
  DetailedIngredient,
  LocalizedContent,
  ProductVariation,
  SuggestedSideItem,
} from './productCustomizationTypes';

/** The first variation in display order — this screen's stand-in for the guest sheet's first radio. */
function firstActive(variations: ProductVariation[]): ProductVariation | null {
  return [...variations].sort((a, b) => a.displayOrder - b.displayOrder)[0] ?? null;
}

interface Localizable {
  name: string;
  content?: LocalizedContent;
}

interface UseProductCustomizationSheetOptions {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: CustomizationResult) => void;
}

/**
 * Everything the waiter's customization sheet knows: what the product offers, what has been picked,
 * what it costs, and — since the load failure stopped being a `console.error` — why the options are
 * missing when they are.
 *
 * Extracted from `ProductCustomization.tsx` so that component is a render again: it was 401 LOC
 * against §4's 250 and had been baselined, and adding the error surface to it would have widened a
 * violation instead of paying it down. Behaviour is unchanged apart from the failure path.
 */
export function useProductCustomizationSheet({
  product,
  isOpen,
  onClose,
  onConfirm,
}: UseProductCustomizationSheetOptions) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.split('-')[0] || 'en';

  const { detail, isLoading, error, reload } = useProductCustomizationDetails(product?.id, isOpen);

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [addedOptionalIngredients, setAddedOptionalIngredients] = useState<Set<string>>(new Set());
  const [selectedSideItems, setSelectedSideItems] = useState<Map<string, number>>(new Map());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  const variations: ProductVariation[] = useMemo(() => (detail?.variations ?? []).filter((v) => v.isActive), [detail]);
  const standardIngredients: DetailedIngredient[] = useMemo(
    () => (detail?.detailedIngredients ?? []).filter((ing) => ing.isActive && !ing.isOptional),
    [detail],
  );
  const optionalIngredients: DetailedIngredient[] = useMemo(
    () => (detail?.detailedIngredients ?? []).filter((ing) => ing.isActive && ing.isOptional),
    [detail],
  );
  const sideItems: SuggestedSideItem[] = useMemo(() => detail?.suggestedSideItems ?? [], [detail]);

  // Seed the selections from whatever just arrived (and clear them when nothing did).
  useEffect(() => {
    setAddedOptionalIngredients(new Set());
    setSpecialInstructions('');
    setQuantity(1);
    // Required side items are pre-ticked: the guest is getting them either way.
    setSelectedSideItems(new Map(sideItems.filter((s) => s.isRequired).map((s) => [s.id, 1])));
    // The base ("no variation") line is not orderable for this product, and this screen has no base
    // row to select — so open on the first active variation instead of on nothing, or the waiter's
    // first tap would post a variation-less add the server refuses (F2).
    setSelectedVariation(isBaseRowHidden(detail?.hideBaseProduct, variations) ? firstActive(variations) : null);
  }, [detail, variations, sideItems]);

  const getLocalizedName = useCallback(
    (item: Localizable | undefined): string =>
      item?.content?.[currentLanguage]?.name || item?.content?.en?.name || item?.name || '',
    [currentLanguage],
  );

  const totalPrice = useMemo(() => {
    let unitPrice = selectedVariation?.finalPrice ?? product.basePrice;

    for (const ing of optionalIngredients) {
      if (addedOptionalIngredients.has(ing.id) && ing.price) unitPrice += ing.price;
    }
    for (const side of sideItems) {
      unitPrice += side.price * (selectedSideItems.get(side.id) || 0);
    }

    return unitPrice * quantity;
  }, [
    product.basePrice,
    selectedVariation,
    optionalIngredients,
    addedOptionalIngredients,
    sideItems,
    selectedSideItems,
    quantity,
  ]);

  const hasCustomizations =
    standardIngredients.length > 0 || optionalIngredients.length > 0 || variations.length > 0 || sideItems.length > 0;

  // The base row is not an option on this screen — "no variation" is expressed by de-selecting the
  // chosen one. When the product hides its base, that de-select would build an order line the
  // server refuses, so it is withheld: tapping the selected variation keeps it (F2).
  const selectVariation = (variation: ProductVariation) => {
    if (selectedVariation?.id !== variation.id) {
      setSelectedVariation(variation);
      return;
    }
    if (!isBaseRowHidden(detail?.hideBaseProduct, variations)) setSelectedVariation(null);
  };

  const toggleOptional = (ingredientId: string) => {
    const next = new Set(addedOptionalIngredients);
    if (!next.delete(ingredientId)) next.add(ingredientId);
    setAddedOptionalIngredients(next);
  };

  const toggleSideItem = (sideItemId: string) => {
    const next = new Map(selectedSideItems);
    if (!next.delete(sideItemId)) next.set(sideItemId, 1);
    setSelectedSideItems(next);
  };

  const handleConfirm = () => {
    const result: CustomizationResult = {
      productId: product.id,
      variationId: selectedVariation?.id,
      variationName: selectedVariation ? getLocalizedName(selectedVariation) : undefined,
      addedIngredients: Array.from(addedOptionalIngredients).map((id) => {
        const ing = optionalIngredients.find((i) => i.id === id);
        return { id, name: getLocalizedName(ing), price: ing?.price || 0 };
      }),
      sideItems: Array.from(selectedSideItems.entries()).map(([id, qty]) => {
        const side = sideItems.find((s) => s.id === id);
        return { id, name: side?.name || '', quantity: qty, price: side?.price || 0 };
      }),
      specialInstructions: specialInstructions || undefined,
      finalPrice: totalPrice / quantity, // Price per unit
    };

    for (let i = 0; i < quantity; i++) onConfirm(result);
    onClose();
  };

  return {
    allergens: detail?.allergens ?? [],
    isLoading,
    error,
    reload,
    variations,
    standardIngredients,
    optionalIngredients,
    sideItems,
    hasCustomizations,
    selectedVariation,
    selectVariation,
    addedOptionalIngredients,
    toggleOptional,
    selectedSideItems,
    toggleSideItem,
    specialInstructions,
    setSpecialInstructions,
    quantity,
    setQuantity,
    totalPrice,
    getLocalizedName,
    handleConfirm,
  };
}

export default useProductCustomizationSheet;
