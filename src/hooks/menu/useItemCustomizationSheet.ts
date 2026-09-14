'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/components/cart/CartContext';
import { useCartFeedback } from '@/hooks/cart/useCartFeedback';
import { getProductById } from '@/services/menuService';
import { buildInitialSheetState, hasCustomizationOptions, toLinePriceInput } from '@/utils/itemSheetState';
import { toBundleItemFromDetail } from '@/utils/catalogItem';
import { localizedDescription, localizedName } from '@/utils/localizedContent';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import type { OpenSheetOptions } from '@/hooks/menu/sheetOptions';
import type { SelectedSide } from '@/utils/linePrice';
import type { CustomizationGroupSelection, DetailedProduct, MenuBundleItem } from '@/types/menu';

interface UseItemCustomizationSheetArgs {
  /** Hand-off for an id that turns out to be a combo — see `toBundleItemFromDetail` for why. */
  onBundleDetected?: (bundle: MenuBundleItem) => void;
  /** Fired after a successful add — the menu page uses it to animate the cart button. */
  onAdded?: () => void;
  /** Commits the drinks step's own basket lines, AFTER this line was accepted (§3.4). */
  onLineAdded?: () => Promise<void>;
}

/**
 * Fetches, seeds, prices and submits the guest product-customization sheet. Products without a
 * choice use the direct-add path unless `forceSheet` asks to show their details.
 */
export function useItemCustomizationSheet({
  onBundleDetected,
  onAdded,
  onLineAdded,
}: UseItemCustomizationSheetArgs = {}) {
  const { addItem } = useCart();
  const { i18n } = useTranslation();
  const { notifyItemAdded, notifyAddFailed } = useCartFeedback();
  const currentLanguage = (i18n.language || 'en').split('-')[0];

  const isOpeningRef = useRef(false);
  const [product, setProduct] = useState<DetailedProduct | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<string, number>>({});
  const [customizationSelections, setCustomizationSelections] = useState<CustomizationGroupSelection[]>([]);
  const [selectedSideItems, setSelectedSideItems] = useState<SelectedSide[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // One success path for both direct-add and the sheet button.
  const notifyAdded = useCallback(
    (added: Pick<DetailedProduct, 'content' | 'name'>) => {
      notifyItemAdded(localizedName(added, currentLanguage));
      onAdded?.();
    },
    [notifyItemAdded, onAdded, currentLanguage],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setProduct(null);
  }, []);

  const openForProduct = useCallback(
    async (productId: string, opts?: OpenSheetOptions) => {
      if (isOpeningRef.current) return;
      isOpeningRef.current = true;
      setIsLoading(true);
      // Direct-add and fetch share this try, so retain which operation actually failed.
      let failedStep: 'load' | 'add' = 'load';
      try {
        const response = (await getProductById(productId)) as { data?: DetailedProduct };
        const detail = response?.data;
        if (!detail) {
          throw new Error('Missing product detail');
        }

        // A combo belongs in the bundle sheet; the caller's availability verdict still wins (§9.2).
        const bundle = toBundleItemFromDetail(detail, opts?.availability);
        if (bundle && onBundleDetected) {
          onBundleDetected(bundle);
          return;
        }

        // Fast path: a plain product adds straight to the cart — unless the caller forced the sheet.
        if (!opts?.forceSheet && !hasCustomizationOptions(detail)) {
          failedStep = 'add';
          await addItem({ productId: detail.id, quantity: 1 });
          notifyAdded(detail);
          return;
        }

        const seed = buildInitialSheetState(detail);
        setSelectedIngredients(seed.selectedIngredients);
        setIngredientQuantities(seed.ingredientQuantities);
        setCustomizationSelections(seed.customizationSelections);
        setSelectedSideItems(seed.selectedSideItems);
        setSelectedVariationId(seed.selectedVariationId);
        setQuantity(1);
        setSpecialInstructions('');
        setProduct(opts?.availability ? { ...detail, availability: opts.availability } : detail);
        setIsOpen(true);
      } catch (error) {
        console.error('Error opening product for customization:', error);
        notifyAddFailed(error, failedStep === 'add' ? undefined : 'error_loading_product');
      } finally {
        setIsLoading(false);
        isOpeningRef.current = false;
      }
    },
    [addItem, notifyAdded, notifyAddFailed, onBundleDetected],
  );

  const title = product ? localizedName(product, currentLanguage) : '';
  // Same fallback chain as the browse card (Track F/F3).
  const description = product ? localizedDescription(product, currentLanguage) : undefined;

  const selection = {
    quantity,
    selectedVariationId,
    selectedIngredients,
    ingredientQuantities,
    selectedSideItems,
    customizationSelections,
  };
  const linePrice = useLinePrice(toLinePriceInput(product, selection));

  const addToCart = useCallback(async () => {
    // Guard the money-path add against double submission (rapid clicks / Enter key).
    if (!product || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addItem({
        productId: product.id,
        productVariationId: selectedVariationId || undefined,
        quantity,
        specialInstructions: specialInstructions || undefined,
        selectedIngredients,
        ingredientQuantities,
        customizationSelections,
        selectedSideItems,
      });
      // Strictly after: a rejected line must not leave a lone drink behind in the basket.
      await onLineAdded?.();
      close();
      notifyAdded(product);
    } catch (error) {
      notifyAddFailed(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addItem,
    close,
    ingredientQuantities,
    customizationSelections,
    isSubmitting,
    notifyAdded,
    notifyAddFailed,
    onLineAdded,
    product,
    quantity,
    selectedIngredients,
    selectedSideItems,
    selectedVariationId,
    specialInstructions,
  ]);

  return {
    kind: 'product' as const,
    isOpen,
    isLoading,
    isSubmitting,
    product,
    title,
    description,
    currentLanguage,
    quantity,
    setQuantity,
    selectedVariationId,
    setSelectedVariationId,
    selectedIngredients,
    setSelectedIngredients,
    ingredientQuantities,
    setIngredientQuantities,
    customizationSelections,
    setCustomizationSelections,
    selectedSideItems,
    setSelectedSideItems,
    specialInstructions,
    setSpecialInstructions,
    linePrice,
    openForProduct,
    addToCart,
    close,
  };
}
