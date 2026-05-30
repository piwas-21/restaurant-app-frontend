'use client';

import { useState, useEffect } from 'react';
import { DetailedIngredient, MenuSectionSuggestedSideItem } from '@/types/menu';
import type { LanguageCode } from '@/components/LanguageSwitcher';
import { calculateCustomizationPrice, buildDefaultIngredientSelections } from '@/utils/productCustomization';

/** The result of customizing a bundle product (ingredients, side items, instructions, price). */
export interface ProductCustomization {
  selectedIngredients: string[];
  excludedIngredients: string[];
  ingredientQuantities: Record<string, number>;
  selectedSideItems: Array<{ id: string; quantity: number }>;
  specialInstructions?: string;
  totalPrice: number;
}

interface UseProductCustomizationArgs {
  isOpen: boolean;
  basePrice: number;
  detailedIngredients: DetailedIngredient[];
  suggestedSideItems: MenuSectionSuggestedSideItem[];
  initialCustomization?: ProductCustomization;
  currentLanguage: LanguageCode;
  onConfirm: (customization: ProductCustomization) => void;
  onClose: () => void;
}

/**
 * State, initialization, pricing, and handlers for the bundle product-customization modal. The
 * component renders from this hook's return value. Pure pricing/default logic lives in
 * utils/productCustomization. Extracted from ProductCustomizationInBundle.tsx (Sprint 4/6);
 * behaviour unchanged.
 */
export function useProductCustomization({
  isOpen,
  basePrice,
  detailedIngredients,
  suggestedSideItems,
  initialCustomization,
  currentLanguage,
  onConfirm,
  onClose,
}: UseProductCustomizationArgs) {
  const [selectedIngredients, setSelectedIngredients] = useState<Set<string>>(new Set());
  const [excludedIngredients, setExcludedIngredients] = useState<Set<string>>(new Set());
  const [ingredientQuantities, setIngredientQuantities] = useState<Record<string, number>>({});
  const [selectedSideItems, setSelectedSideItems] = useState<Map<string, number>>(new Map());
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Translated ingredient name, falling back to English then the raw name.
  const getIngredientName = (ingredient: DetailedIngredient): string => {
    return ingredient.content?.[currentLanguage]?.name || ingredient.content?.en?.name || ingredient.name;
  };

  useEffect(() => {
    if (isOpen) {
      // Initialize with default selections or previous customization
      if (initialCustomization) {
        setSelectedIngredients(new Set(initialCustomization.selectedIngredients));
        setExcludedIngredients(new Set(initialCustomization.excludedIngredients));
        setIngredientQuantities(initialCustomization.ingredientQuantities);
        const sidesMap = new Map<string, number>();
        initialCustomization.selectedSideItems.forEach((si) => sidesMap.set(si.id, si.quantity));
        setSelectedSideItems(sidesMap);
        setSpecialInstructions(initialCustomization.specialInstructions || '');
      } else {
        const { selected, quantities } = buildDefaultIngredientSelections(detailedIngredients);
        setSelectedIngredients(selected);
        setExcludedIngredients(new Set());
        setIngredientQuantities(quantities);
        setSelectedSideItems(new Map());
        setSpecialInstructions('');
      }
    }
  }, [isOpen, detailedIngredients, initialCustomization]);

  const calculateTotalPrice = (): number =>
    calculateCustomizationPrice(
      basePrice,
      detailedIngredients,
      selectedIngredients,
      ingredientQuantities,
      selectedSideItems,
      suggestedSideItems,
    );

  const handleIngredientToggle = (ingredient: DetailedIngredient) => {
    const newSelected = new Set(selectedIngredients);
    const newExcluded = new Set(excludedIngredients);
    const newQuantities = { ...ingredientQuantities };

    // Non-optional ingredients cannot be deselected
    if (!ingredient.isOptional) {
      return;
    }

    // Optional ingredient: toggle selection
    if (newSelected.has(ingredient.id)) {
      newSelected.delete(ingredient.id);
      delete newQuantities[ingredient.id];
    } else {
      newSelected.add(ingredient.id);
      newQuantities[ingredient.id] = 1;
    }

    setSelectedIngredients(newSelected);
    setExcludedIngredients(newExcluded);
    setIngredientQuantities(newQuantities);
  };

  const handleIngredientQuantityChange = (ingredientId: string, delta: number) => {
    const ingredient = detailedIngredients.find((i) => i.id === ingredientId);
    if (!ingredient) return;

    const currentQty = ingredientQuantities[ingredientId] || 1;
    const newQty = Math.max(1, Math.min(ingredient.maxQuantity, currentQty + delta));

    setIngredientQuantities({
      ...ingredientQuantities,
      [ingredientId]: newQty,
    });
  };

  const handleSideItemToggle = (sideItem: MenuSectionSuggestedSideItem) => {
    const newSides = new Map(selectedSideItems);

    if (newSides.has(sideItem.id)) {
      newSides.delete(sideItem.id);
    } else {
      newSides.set(sideItem.id, 1);
    }

    setSelectedSideItems(newSides);
  };

  const handleSideItemQuantityChange = (sideId: string, delta: number) => {
    const newSides = new Map(selectedSideItems);
    const currentQty = newSides.get(sideId) || 1;
    const newQty = Math.max(1, currentQty + delta);

    newSides.set(sideId, newQty);
    setSelectedSideItems(newSides);
  };

  const handleConfirm = () => {
    const customization: ProductCustomization = {
      selectedIngredients: Array.from(selectedIngredients),
      excludedIngredients: Array.from(excludedIngredients),
      ingredientQuantities,
      selectedSideItems: Array.from(selectedSideItems.entries()).map(([id, quantity]) => ({
        id,
        quantity,
      })),
      specialInstructions: specialInstructions.trim() || undefined,
      totalPrice: calculateTotalPrice(),
    };

    onConfirm(customization);
    onClose();
  };

  const totalPrice = calculateTotalPrice();
  const hasCustomizableItems = detailedIngredients.length > 0 || suggestedSideItems.length > 0;

  return {
    selectedIngredients,
    ingredientQuantities,
    selectedSideItems,
    specialInstructions,
    setSpecialInstructions,
    getIngredientName,
    handleIngredientToggle,
    handleIngredientQuantityChange,
    handleSideItemToggle,
    handleSideItemQuantityChange,
    handleConfirm,
    totalPrice,
    hasCustomizableItems,
  };
}
