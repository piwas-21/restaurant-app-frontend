'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isBaseRowHidden } from '@/utils/baseProductVisibility';
import { toPriceableIngredients } from '@/utils/priceableIngredient';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import type { Product } from '@/services/serverService';
import { useProductCustomizationDetails } from './useProductCustomizationDetails';
import { useWaiterIngredientSelection } from './useWaiterIngredientSelection';
import { buildCustomizationResult } from './waiterSelection';
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
 * Since S7 it costs what the GUEST sheet costs. The `totalPrice` memo that used to live here summed
 * `variation.finalPrice + Σ selected optional price + Σ side price × quantity`: a second price
 * policy, blind to `isIncludedInBasePrice` and to `maxQuantity`, which charged CHF 2 for cheese the
 * base price had already bought. It is gone. The sheet seeds from the base recipe
 * (`useWaiterIngredientSelection`) and prices through `useLinePrice` — the shared port of
 * `BasketPricingService.CalculateIngredientCustomizationPrice` the guest sheet already used.
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
  const ingredientSelection = useWaiterIngredientSelection();
  const { seedFromBaseRecipe } = ingredientSelection;

  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(null);
  const [selectedSideItems, setSelectedSideItems] = useState<Map<string, number>>(new Map());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);

  const variations: ProductVariation[] = useMemo(() => (detail?.variations ?? []).filter((v) => v.isActive), [detail]);
  const allIngredients: DetailedIngredient[] = useMemo(() => detail?.detailedIngredients ?? [], [detail]);
  const standardIngredients = useMemo(
    () => allIngredients.filter((ing) => ing.isActive && !ing.isOptional),
    [allIngredients],
  );
  const optionalIngredients = useMemo(
    () => allIngredients.filter((ing) => ing.isActive && ing.isOptional),
    [allIngredients],
  );
  const sideItems: SuggestedSideItem[] = useMemo(() => detail?.suggestedSideItems ?? [], [detail]);
  // ONE input contract for the ONE price math — see utils/priceableIngredient.ts.
  const priceableIngredients = useMemo(() => toPriceableIngredients(allIngredients), [allIngredients]);

  // Seed the selections from whatever just arrived (and clear them when nothing did).
  useEffect(() => {
    seedFromBaseRecipe(allIngredients);
    setSpecialInstructions('');
    setQuantity(1);
    // Required side items are pre-ticked: the guest is getting them either way.
    setSelectedSideItems(new Map(sideItems.filter((s) => s.isRequired).map((s) => [s.id, 1])));
    // The base ("no variation") line is not orderable for this product, and this screen has no base
    // row to select — so open on the first active variation instead of on nothing, or the waiter's
    // first tap would post a variation-less add the server refuses (F2).
    setSelectedVariation(isBaseRowHidden(detail?.hideBaseProduct, variations) ? firstActive(variations) : null);
  }, [detail, variations, sideItems, allIngredients, seedFromBaseRecipe]);

  const getLocalizedName = useCallback(
    (item: Localizable | undefined): string =>
      item?.content?.[currentLanguage]?.name || item?.content?.en?.name || item?.name || '',
    [currentLanguage],
  );

  const selectedSides = useMemo(
    () => Array.from(selectedSideItems.entries()).map(([id, qty]) => ({ id, quantity: qty })),
    [selectedSideItems],
  );

  // The shared, backend-faithful price. `detail.basePrice` in preference to the list product's: the
  // same number, but read from the payload the rest of this line is priced from.
  const linePrice = useLinePrice({
    kind: 'product',
    basePrice: detail?.basePrice ?? product.basePrice,
    quantity,
    variations,
    selectedVariationId: selectedVariation?.id ?? null,
    ingredients: priceableIngredients,
    selectedIngredientIds: ingredientSelection.selectedIngredients,
    ingredientQuantities: ingredientSelection.ingredientQuantities,
    // #605. Omitted, `useLinePrice` reads it as 0 — "no sauces are included" — and this sheet charges
    // for sauces the admin marked free. Display-only where the server reprices, but a real overcharge
    // on a line with `childItems`: that shape is the one the server refuses to reprice, so the
    // DECLARED price stands and the declared number comes from here.
    sauceIncludedFree: detail?.sauceIncludedFree ?? 0,
    sides: sideItems,
    selectedSides,
  });

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

  const toggleSideItem = (sideItemId: string) => {
    const next = new Map(selectedSideItems);
    if (!next.delete(sideItemId)) next.set(sideItemId, 1);
    setSelectedSideItems(next);
  };

  const handleConfirm = () => {
    const result = buildCustomizationResult({
      productId: product.id,
      variationId: selectedVariation?.id,
      variationName: selectedVariation ? getLocalizedName(selectedVariation) : undefined,
      ingredients: allIngredients,
      selection: {
        selectedIngredientIds: ingredientSelection.selectedIngredients,
        ingredientQuantities: ingredientSelection.ingredientQuantities,
      },
      sideItems,
      selectedSideItems,
      specialInstructions,
      // Straight from the shared math — this function does not re-derive a unit price, or there
      // would be two writers again.
      unitPrice: linePrice.unitPrice,
      nameOf: getLocalizedName,
    });

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
    selectedIngredients: ingredientSelection.selectedIngredients,
    ingredientQuantities: ingredientSelection.ingredientQuantities,
    toggleIngredient: ingredientSelection.toggleIngredient,
    stepIngredient: ingredientSelection.stepIngredient,
    selectedSideItems,
    toggleSideItem,
    specialInstructions,
    setSpecialInstructions,
    quantity,
    setQuantity,
    totalPrice: linePrice.total,
    unitPrice: linePrice.unitPrice,
    getLocalizedName,
    handleConfirm,
  };
}

export default useProductCustomizationSheet;
