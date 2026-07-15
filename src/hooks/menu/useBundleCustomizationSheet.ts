'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCart } from '@/components/cart/CartContext';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import {
  bundleOptionKey,
  buildDefaultBundleSelection,
  findBundleSelectionErrors,
  toggleBundleOption,
  updateBundleOption,
} from '@/utils/bundleSelection';
import type { MenuBundleItem, MenuSection, SelectedMenuOption } from '@/types/menu';

interface UseBundleCustomizationSheetArgs {
  /** Fired after a successful add — the menu page uses it to animate the cart button. */
  onAdded?: () => void;
}

/**
 * Drives the bundle body of the customer customization sheet (menu-bundles redesign #175, slice 6),
 * replacing `MenuCustomizationModal`. Seeds each section's default options from the one base-recipe
 * rule, live-prices via the shared backend-faithful `useLinePrice`, gates required sections, and
 * adds the bundle line to the basket.
 *
 * No fetch on open: the bundle list payload already carries the full `menuDefinition` (sections →
 * items → per-option `DetailedIngredients`) the drill-in needs.
 */
export function useBundleCustomizationSheet({ onAdded }: UseBundleCustomizationSheetArgs = {}) {
  const { addItem } = useCart();
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const currentLanguage = (i18n.language || 'en').split('-')[0];

  const [bundle, setBundle] = useState<MenuBundleItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedMenuOption[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [expandedOptionKey, setExpandedOptionKey] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const sections = useMemo(() => bundle?.menuDefinition?.sections ?? [], [bundle]);

  const title = bundle ? bundle.content?.[currentLanguage]?.name || bundle.content?.en?.name || bundle.name : '';
  const description = bundle?.content?.[currentLanguage]?.description || bundle?.content?.en?.description;

  const close = useCallback(() => {
    setIsOpen(false);
    setBundle(null);
  }, []);

  const openForBundle = useCallback(
    (next: MenuBundleItem) => {
      if (!next.menuDefinition) {
        enqueueSnackbar(t('error_adding_to_cart', 'Failed to add item to cart'), { variant: 'error' });
        return;
      }

      setSelectedOptions(buildDefaultBundleSelection(next.menuDefinition.sections));
      setQuantity(1);
      setSpecialInstructions('');
      setExpandedOptionKey(null);
      setShowValidation(false);
      setBundle(next);
      setIsOpen(true);
    },
    [enqueueSnackbar, t],
  );

  const linePrice = useLinePrice({
    kind: 'bundle',
    basePrice: bundle?.basePrice ?? 0,
    quantity,
    sections,
    selectedOptions,
  });

  // Derived, so a section's error clears the moment it is satisfied. Held back until the guest has
  // actually tried to add — a freshly-opened sheet does not greet them with red text.
  const selectionErrors = useMemo(
    () => findBundleSelectionErrors(sections, selectedOptions),
    [sections, selectedOptions],
  );
  const visibleErrors = useMemo(() => (showValidation ? selectionErrors : []), [showValidation, selectionErrors]);

  const toggleOption = useCallback((section: MenuSection, itemId: string) => {
    setSelectedOptions((prev) => toggleBundleOption(section, prev, itemId));
  }, []);

  const setOptionCustomization = useCallback(
    (sectionId: string, itemId: string, patch: Partial<SelectedMenuOption>) => {
      setSelectedOptions((prev) => updateBundleOption(prev, sectionId, itemId, patch));
    },
    [],
  );

  const toggleOptionExpanded = useCallback((sectionId: string, itemId: string) => {
    const key = bundleOptionKey(sectionId, itemId);
    setExpandedOptionKey((prev) => (prev === key ? null : key));
  }, []);

  const addToCart = useCallback(async () => {
    // Guard the money-path add against double submission (rapid clicks / Enter key).
    if (!bundle || isSubmitting) return;

    if (selectionErrors.length > 0) {
      setShowValidation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await addItem({
        productId: bundle.id,
        quantity,
        specialInstructions: specialInstructions || undefined,
        selectedMenuOptions: selectedOptions,
      });
      close();
      enqueueSnackbar(t('item_added_to_cart_toast', { itemName: title }), {
        variant: 'success',
        autoHideDuration: 2000,
        anchorOrigin: { vertical: 'top', horizontal: 'center' },
      });
      onAdded?.();
    } catch {
      enqueueSnackbar(t('error_adding_to_cart', 'Failed to add item to cart'), { variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addItem,
    bundle,
    close,
    enqueueSnackbar,
    isSubmitting,
    onAdded,
    quantity,
    selectedOptions,
    selectionErrors,
    specialInstructions,
    t,
    title,
  ]);

  return {
    kind: 'bundle' as const,
    isOpen,
    isSubmitting,
    bundle,
    sections,
    title,
    description,
    currentLanguage,
    quantity,
    setQuantity,
    selectedOptions,
    toggleOption,
    setOptionCustomization,
    expandedOptionKey,
    toggleOptionExpanded,
    specialInstructions,
    setSpecialInstructions,
    visibleErrors,
    linePrice,
    openForBundle,
    addToCart,
    close,
  };
}
