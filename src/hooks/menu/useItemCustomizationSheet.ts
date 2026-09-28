'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/components/cart/CartContext';
import { useCartFeedback } from '@/hooks/cart/useCartFeedback';
import { useOrderTypeProductRefresh } from '@/hooks/menu/useOrderTypeProductRefresh';
import { getProductById } from '@/services/menuService';
import { buildInitialSheetState, hasCustomizationOptions, toLinePriceInput } from '@/utils/itemSheetState';
import { toBundleItemFromDetail } from '@/utils/catalogItem';
import { localizedDescription, localizedName } from '@/utils/localizedContent';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import type { OpenSheetOptions, UseItemCustomizationSheetArgs } from '@/hooks/menu/sheetOptions';
import type { SelectedSide } from '@/utils/linePrice';
import type { CustomizationGroupSelection, DetailedProduct } from '@/types/menu';
import type { OfferMode } from '@/types/menu/offerFamily';
import type { OrderType } from '@/types/order';

/** Fetches, seeds, prices, and submits the guest product-customization sheet. */
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
  const [detailOrderType, setDetailOrderType] = useState<OrderType | null | undefined>(undefined);
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
  const [offerMode, setOfferMode] = useState<OfferMode | undefined>(undefined);
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
    setDetailOrderType(undefined);
    setOfferMode(undefined);
  }, []);
  const { currentOrderTypeRef, orderType } = useOrderTypeProductRefresh({
    isOpen,
    product,
    detailOrderType,
    setProduct,
    setSelections: setCustomizationSelections,
    setDetailOrderType,
    setIsLoading,
    closeSheet: close,
    notifyAddFailed,
  });
  const openForProduct = useCallback(
    async (productId: string, opts?: OpenSheetOptions) => {
      if (isOpeningRef.current) return;
      isOpeningRef.current = true;
      setIsLoading(true);
      let failedStep: 'load' | 'add' = 'load';
      try {
        const requestedOrderType = currentOrderTypeRef.current;
        const response = (await getProductById(productId, undefined, requestedOrderType)) as {
          data?: DetailedProduct;
        };
        const detail = response?.data;
        if (!detail) throw new Error('Missing product detail');

        const bundle = toBundleItemFromDetail(detail, opts?.availability);
        if (bundle && onBundleDetected) {
          onBundleDetected(bundle, { availability: opts?.availability, offerMode: opts?.offerMode });
          return;
        }

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
        setSelectedVariationId(opts?.selectedVariationId ?? seed.selectedVariationId);
        setOfferMode(opts?.offerMode);
        setQuantity(1);
        setSpecialInstructions('');
        setDetailOrderType(requestedOrderType);
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
    [addItem, currentOrderTypeRef, notifyAdded, notifyAddFailed, onBundleDetected],
  );

  const title = product ? localizedName(product, currentLanguage) : '';
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
    if (!product || isSubmitting || detailOrderType !== orderType) return;
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
    detailOrderType,
    isSubmitting,
    notifyAdded,
    notifyAddFailed,
    onLineAdded,
    product,
    quantity,
    orderType,
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
    offerMode,
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
