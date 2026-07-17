'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCart } from '@/components/cart/CartContext';
import { getProductById } from '@/services/menuService';
import { buildInitialSheetState, hasCustomizationOptions } from '@/utils/itemSheetState';
import { toBundleItemFromDetail } from '@/utils/catalogItem';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import type { SelectedSide } from '@/utils/linePrice';
import type { DetailedProduct, MenuBundleItem } from '@/types/menu';

interface UseItemCustomizationSheetArgs {
  /** Hand-off for an id that turns out to be a combo — see `toBundleItemFromDetail` for why. */
  onBundleDetected?: (bundle: MenuBundleItem) => void;
  /** Fired after a successful add — the menu page uses it to animate the cart button. */
  onAdded?: () => void;
}

/**
 * Drives the customer product-customization sheet (menu-bundles redesign #175, slice 6): fetches the
 * detail on open via the `getProductById` service, seeds from `buildInitialSheetState`, live-prices
 * with the shared `useLinePrice`, and adds the line. A product with nothing to choose is added
 * straight to the cart without opening — matching the previous behaviour.
 */
export function useItemCustomizationSheet({ onBundleDetected, onAdded }: UseItemCustomizationSheetArgs = {}) {
  const { addItem } = useCart();
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const currentLanguage = (i18n.language || 'en').split('-')[0];

  // Guards the whole open path, not just Add: the no-options branch adds straight to the cart, so
  // a second tap during the fetch would add the line twice.
  const isOpeningRef = useRef(false);
  const [product, setProduct] = useState<DetailedProduct | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<string, number>>({});
  const [selectedSideItems, setSelectedSideItems] = useState<SelectedSide[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const resolveName = useCallback(
    (p: Pick<DetailedProduct, 'content' | 'name'>) =>
      p.content?.[currentLanguage]?.name || p.content?.en?.name || p.name,
    [currentLanguage],
  );

  // One add-success path for both the direct-add and the sheet's Add button — they had drifted
  // into two copies of the same snackbar, and each would now need its own `onAdded` call.
  const notifyAdded = useCallback(
    (added: Pick<DetailedProduct, 'content' | 'name'>) => {
      enqueueSnackbar(t('item_added_to_cart_toast', { itemName: resolveName(added) }), {
        variant: 'success',
        autoHideDuration: 2000,
        anchorOrigin: { vertical: 'top', horizontal: 'center' },
      });
      onAdded?.();
    },
    [enqueueSnackbar, onAdded, resolveName, t],
  );

  const close = useCallback(() => {
    setIsOpen(false);
    setProduct(null);
  }, []);

  const openForProduct = useCallback(
    async (productId: string) => {
      if (isOpeningRef.current) return;
      isOpeningRef.current = true;
      setIsLoading(true);
      try {
        const response = (await getProductById(productId)) as { data?: DetailedProduct };
        const detail = response?.data;
        if (!detail) {
          throw new Error('Missing product detail');
        }

        // The id turned out to be a combo — hand it to the bundle sheet rather than render a
        // product body with none of its sections.
        const bundle = toBundleItemFromDetail(detail);
        if (bundle && onBundleDetected) {
          onBundleDetected(bundle);
          return;
        }

        if (!hasCustomizationOptions(detail)) {
          await addItem({ productId: detail.id, quantity: 1 });
          notifyAdded(detail);
          return;
        }

        const seed = buildInitialSheetState(detail);
        setSelectedIngredients(seed.selectedIngredients);
        setIngredientQuantities(seed.ingredientQuantities);
        setSelectedSideItems(seed.selectedSideItems);
        setSelectedVariationId(seed.selectedVariationId);
        setQuantity(1);
        setSpecialInstructions('');
        setProduct(detail);
        setIsOpen(true);
      } catch (error) {
        console.error('Error loading product for customization:', error);
        enqueueSnackbar(t('error_loading_product', 'Failed to load product details'), { variant: 'error' });
      } finally {
        setIsLoading(false);
        isOpeningRef.current = false;
      }
    },
    [addItem, enqueueSnackbar, notifyAdded, onBundleDetected, t],
  );

  const title = product ? resolveName(product) : '';
  const description = product?.content?.[currentLanguage]?.description || product?.content?.en?.description;

  const linePrice = useLinePrice({
    kind: 'product',
    basePrice: product?.basePrice ?? 0,
    quantity,
    variations: product?.variations,
    selectedVariationId,
    ingredients: product?.detailedIngredients,
    selectedIngredientIds: selectedIngredients,
    ingredientQuantities,
    sides: product?.suggestedSideItems,
    selectedSides: selectedSideItems,
  });

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
        selectedSideItems,
      });
      close();
      notifyAdded(product);
    } catch {
      enqueueSnackbar(t('error_adding_to_cart', 'Failed to add item to cart'), { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addItem,
    close,
    enqueueSnackbar,
    ingredientQuantities,
    isSubmitting,
    notifyAdded,
    product,
    quantity,
    selectedIngredients,
    selectedSideItems,
    selectedVariationId,
    specialInstructions,
    t,
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
