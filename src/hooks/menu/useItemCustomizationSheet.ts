'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCart } from '@/components/cart/CartContext';
import { getProductById } from '@/services/menuService';
import { buildBaseIngredientSelection } from '@/utils/ingredientSelection';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import type { DetailedProduct } from '@/types/menu';

interface SelectedSide {
  id: string;
  quantity: number;
}

/**
 * Drives the customer product-customization sheet (menu-bundles redesign #175, slice 6): fetches the
 * full product detail on open (via the `getProductById` service — replacing `MenuItem`'s rogue
 * `fetch()`), seeds the selection from the one base-recipe default rule, live-prices with the shared
 * `useLinePrice`, and adds the customised line to the basket. Products with no customization options
 * are added straight to the cart without opening the sheet — matching the previous behaviour.
 */
export function useItemCustomizationSheet() {
  const { addItem } = useCart();
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const currentLanguage = i18n.language.split('-')[0] || 'en';

  const [product, setProduct] = useState<DetailedProduct | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  const close = useCallback(() => {
    setIsOpen(false);
    setProduct(null);
  }, []);

  const openForProduct = useCallback(
    async (productId: string) => {
      setIsLoading(true);
      try {
        const response = (await getProductById(productId)) as { data?: DetailedProduct };
        const detail = response?.data;
        if (!detail) {
          throw new Error('Missing product detail');
        }

        const hasCustomization =
          (detail.variations?.length ?? 0) > 0 ||
          (detail.detailedIngredients?.length ?? 0) > 0 ||
          (detail.suggestedSideItems?.length ?? 0) > 0;

        if (!hasCustomization) {
          await addItem({ productId: detail.id, quantity: 1 });
          enqueueSnackbar(t('item_added_to_cart_toast', { itemName: resolveName(detail) }), {
            variant: 'success',
            autoHideDuration: 2000,
            anchorOrigin: { vertical: 'top', horizontal: 'center' },
          });
          return;
        }

        const base = buildBaseIngredientSelection(detail.detailedIngredients ?? []);
        setSelectedIngredients(base.selectedIngredients);
        setIngredientQuantities(base.ingredientQuantities);
        setSelectedSideItems(
          (detail.suggestedSideItems ?? []).filter((s) => s.isRequired).map((s) => ({ id: s.id, quantity: 1 })),
        );
        setSelectedVariationId(null);
        setQuantity(1);
        setSpecialInstructions('');
        setProduct(detail);
        setIsOpen(true);
      } catch (error) {
        console.error('Error loading product for customization:', error);
        enqueueSnackbar(t('error_loading_product', 'Failed to load product details'), { variant: 'error' });
      } finally {
        setIsLoading(false);
      }
    },
    [addItem, enqueueSnackbar, resolveName, t],
  );

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
    if (!product) return;
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
      enqueueSnackbar(t('item_added_to_cart_toast', { itemName: resolveName(product) }), {
        variant: 'success',
        autoHideDuration: 2000,
        anchorOrigin: { vertical: 'top', horizontal: 'center' },
      });
    } catch {
      enqueueSnackbar(t('error_adding_to_cart', 'Failed to add item to cart'), { variant: 'error' });
    }
  }, [
    addItem,
    close,
    enqueueSnackbar,
    ingredientQuantities,
    product,
    quantity,
    resolveName,
    selectedIngredients,
    selectedSideItems,
    selectedVariationId,
    specialInstructions,
    t,
  ]);

  return {
    isOpen,
    isLoading,
    product,
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
