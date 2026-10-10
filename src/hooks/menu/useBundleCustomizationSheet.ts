'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCart } from '@/components/cart/CartContext';
import { useBundleOptionTour } from '@/hooks/menu/useBundleOptionTour';
import { useBundleOptionRecovery } from '@/hooks/menu/useBundleOptionRecovery';
import { useCartFeedback } from '@/hooks/cart/useCartFeedback';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import {
  buildGuestDefaultBundleSelection,
  findBundleSelectionErrors,
  toggleBundleOptionWithDependencies,
  updateBundleOption,
} from '@/utils/bundleSelection';
import { localizedDescription, localizedMenuSection, localizedName } from '@/utils/localizedContent';
import type { MenuBundleItem, MenuSection, SelectedMenuOption } from '@/types/menu';
import type { OpenSheetOptions } from './sheetOptions';
import type { OfferMode } from '@/types/menu/offerFamily';

interface UseBundleCustomizationSheetArgs {
  onAdded?: () => void;
  onLineAdded?: () => Promise<void>;
}

export function useBundleCustomizationSheet({ onAdded, onLineAdded }: UseBundleCustomizationSheetArgs = {}) {
  const { addItem } = useCart();
  const { i18n } = useTranslation();
  const { notifyItemAdded, notifyAddFailed } = useCartFeedback();
  const currentLanguage = (i18n.language || 'en').split('-')[0];

  const [bundle, setBundle] = useState<MenuBundleItem | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedMenuOption[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [offerMode, setOfferMode] = useState<OfferMode | undefined>(undefined);
  const [showValidation, setShowValidation] = useState(false);
  const sections = useMemo(
    () => (bundle?.menuDefinition?.sections ?? []).map((section) => localizedMenuSection(section, currentLanguage)),
    [bundle, currentLanguage],
  );
  const recovery = useBundleOptionRecovery(sections, selectedOptions, setSelectedOptions);
  const optionTour = useBundleOptionTour({ sections, selectedOptions });
  const {
    customizingOption,
    tourSectionId: optionTourSectionId,
    openForReview: openOptionCustomization,
    beginAt: beginOptionTourAt,
    begin: beginOptionTour,
    advance: advanceOptionTour,
    close: closeOptionCustomization,
    reset: resetOptionTour,
    handleDeselection: forgetTouredOption,
  } = optionTour;
  const title = bundle ? localizedName(bundle, currentLanguage) : '';
  const description = bundle ? localizedDescription(bundle, currentLanguage) : undefined;
  const close = useCallback(() => {
    setIsOpen(false);
    setBundle(null);
    setOfferMode(undefined);
    resetOptionTour();
  }, [resetOptionTour]);
  const openForBundle = useCallback(
    (next: MenuBundleItem, opts?: Pick<OpenSheetOptions, 'availability' | 'offerMode'>) => {
      if (!next.menuDefinition) {
        notifyAddFailed(null);
        return;
      }

      setSelectedOptions(buildGuestDefaultBundleSelection(next.menuDefinition.sections, next.customerStepManifest));
      setQuantity(1);
      setSpecialInstructions('');
      resetOptionTour();
      setShowValidation(false);
      setOfferMode(opts?.offerMode);
      setBundle(opts?.availability ? { ...next, availability: opts.availability } : next);
      setIsOpen(true);
    },
    [notifyAddFailed, resetOptionTour],
  );
  const linePrice = useLinePrice({
    kind: 'bundle',
    basePrice: bundle?.basePrice ?? 0,
    quantity,
    sections,
    selectedOptions,
  });
  const selectionErrors = useMemo(
    () => findBundleSelectionErrors(sections, selectedOptions, bundle?.customerStepManifest),
    [sections, selectedOptions, bundle?.customerStepManifest],
  );
  const visibleErrors = useMemo(() => (showValidation ? selectionErrors : []), [showValidation, selectionErrors]);
  const toggleOption = useCallback(
    (section: MenuSection, itemId: string, productVariationId?: string | null, menuSectionItemId?: string) => {
      setSelectedOptions((prev) =>
        toggleBundleOptionWithDependencies(
          section,
          prev,
          itemId,
          productVariationId,
          menuSectionItemId,
          bundle?.customerStepManifest,
        ),
      );
      forgetTouredOption(section.id, itemId, productVariationId, menuSectionItemId);
    },
    [bundle?.customerStepManifest, forgetTouredOption],
  );

  const setOptionCustomization = useCallback(
    (
      sectionId: string,
      itemId: string,
      patch: Partial<SelectedMenuOption>,
      productVariationId?: string | null,
      menuSectionItemId?: string,
    ) => {
      setSelectedOptions((prev) =>
        updateBundleOption(prev, sectionId, itemId, patch, productVariationId, menuSectionItemId),
      );
    },
    [],
  );

  const addToCart = useCallback(async () => {
    if (!bundle || isSubmitting) return;

    if (selectionErrors.length > 0 || recovery.hasUnresolvedOptions) {
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
      await onLineAdded?.();
      close();
      notifyItemAdded(title);
      onAdded?.();
    } catch (error) {
      notifyAddFailed(error);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    addItem,
    bundle,
    close,
    isSubmitting,
    notifyAddFailed,
    notifyItemAdded,
    onAdded,
    onLineAdded,
    quantity,
    selectedOptions,
    selectionErrors,
    recovery.hasUnresolvedOptions,
    specialInstructions,
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
    offerMode,
    currentLanguage,
    quantity,
    setQuantity,
    selectedOptions,
    toggleOption,
    setOptionCustomization,
    clearUnresolvedOptions: recovery.clearUnresolvedOptions,
    customizingOption,
    optionTourSectionId,
    openOptionCustomization,
    beginOptionTour,
    beginOptionTourAt,
    advanceOptionTour,
    closeOptionCustomization,
    specialInstructions,
    setSpecialInstructions,
    visibleErrors,
    linePrice,
    openForBundle,
    addToCart,
    close,
  };
}
