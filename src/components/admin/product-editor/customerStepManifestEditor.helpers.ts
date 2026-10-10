import type { ProductDetails, Variation } from '@/app/admin/menu-management/interfaces';
import type {
  CustomerStepManifest,
  DetailedProduct,
  DetailedProductVariation,
  MenuSection,
  ProductCustomizationGroup,
  ProductType,
} from '@/types/menu';
import { isBundleComponentStep } from '@/types/menu';
import type { EditorSectionsContext } from './editorSectionTypes';
import { defaultBundleStepManifestParts, defaultProductStepManifestParts } from '@/utils/customerStepManifest';
import { isPersistedMenuId } from '@/utils/menuSectionDraft';

export function getDefaultSteps({
  product,
  isBundle,
  sections,
  detailedIngredients,
  customizationGroups,
  variations,
  hideBaseProduct,
}: {
  product: ProductDetails;
  isBundle: boolean;
  sections: readonly MenuSection[];
  detailedIngredients: EditorSectionsContext['editor']['detailedIngredients'];
  customizationGroups: EditorSectionsContext['editor']['customizationGroups'];
  variations: readonly Variation[];
  hideBaseProduct: boolean;
}): { steps: CustomerStepManifest['steps']; unsupported: number } {
  if (isBundle) {
    const all = defaultBundleStepManifestParts(sections);
    const steps = all.filter(isPersistedBundleStep);
    return { steps, unsupported: all.length - steps.length };
  }

  const sides = (product.suggestedSideItems ?? []).map((side, displayOrder) => ({
    id: side.id,
    suggestedSideItemId: side.suggestedSideItemId,
    name: side.name,
    price: side.price,
    isRequired: side.isRequired,
    displayOrder,
    type: side.type,
  }));
  const all = defaultProductStepManifestParts({
    variations: variations
      .filter((row): row is Variation & { id: string } => Boolean(row.id))
      .map((row) => ({ id: row.id, isActive: row.isActive })),
    hideBaseProduct,
    ingredients: detailedIngredients,
    groups: customizationGroups.filter((group): group is ProductCustomizationGroup & { id: string } =>
      Boolean(group.id),
    ),
    sides,
  });
  const steps = all.filter(
    (step) => step.kind.startsWith('Product') && 'targetId' in step && isPersistedMenuId(step.targetId),
  );
  const missingSideRefs = (product.suggestedSideItems ?? []).filter((side) => !side.suggestedSideItemId).length;
  const missingDraftIds =
    variations.filter((row) => !row.id).length + customizationGroups.filter((group) => !group.id).length;
  return { steps, unsupported: all.length - steps.length + missingSideRefs + missingDraftIds };
}

function isPersistedBundleStep(step: CustomerStepManifest['steps'][number]): boolean {
  if (step.kind === 'BundleSection') return isPersistedMenuId(step.targetId);
  if (!isBundleComponentStep(step)) return false;
  return (
    isPersistedMenuId(step.sectionId) &&
    isPersistedMenuId(step.sectionItemId) &&
    isPersistedMenuId(step.productId) &&
    isPersistedMenuId(step.scopeId)
  );
}

export function toPreviewProduct(
  product: ProductDetails,
  editor: Pick<
    EditorSectionsContext['editor'],
    'customerStepManifest' | 'basePrice' | 'detailedIngredients' | 'customizationGroups'
  >,
  rows: readonly Variation[],
  name: string,
  hideBaseProduct: boolean,
): DetailedProduct {
  const variations: DetailedProductVariation[] = rows
    .filter((row): row is Variation & { id: string } => isPersistedMenuId(row.id))
    .map((row, index) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      priceModifier: row.priceModifier,
      finalPrice: row.finalPrice,
      isActive: row.isActive,
      displayOrder: row.displayOrder ?? index,
      content: row.content as DetailedProductVariation['content'],
    }));
  return {
    id: product.id,
    customerStepManifest: editor.customerStepManifest,
    name,
    description: product.description,
    basePrice: editor.basePrice,
    isActive: product.isActive,
    isAvailable: product.isAvailable,
    isSpecial: Boolean(product.isSpecial),
    hideBaseProduct,
    preparationTimeMinutes: product.preparationTimeMinutes,
    type: product.type as ProductType,
    ingredients: product.ingredients ?? [],
    detailedIngredients: editor.detailedIngredients.map((row) => ({
      ...row,
      maxQuantity: row.maxQuantity ?? 1,
      isIncludedInBasePrice: row.isIncludedInBasePrice ?? false,
    })),
    customizationGroups: editor.customizationGroups.filter(
      (group): group is ProductCustomizationGroup & { id: string } => isPersistedMenuId(group.id),
    ),
    allergens: product.allergens ?? [],
    displayOrder: product.displayOrder ?? 0,
    content: (product.content ?? {}) as DetailedProduct['content'],
    images: [],
    categories: [],
    variations,
    suggestedSideItems: (product.suggestedSideItems ?? []).map((side, displayOrder) => ({
      id: side.id,
      suggestedSideItemId: side.suggestedSideItemId,
      name: side.name,
      price: side.price,
      isRequired: side.isRequired,
      displayOrder,
      type: side.type,
    })),
    sauceMin: product.sauceMin,
    sauceMax: product.sauceMax,
    sauceIncludedFree: product.sauceIncludedFree,
  };
}
