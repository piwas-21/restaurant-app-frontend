'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { pickEditorSchema } from '@/components/admin/product/schemas';
import { submitEditProductForm, submitProductForm } from '@/components/admin/product/productFormUtils';
import type { ProductDetails, ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import { toSubmittableMenuDefinition } from '@/utils/menuSectionDraft';
import { reportProductImageUploadFailure } from '@/utils/productImageFailure';
import { toBundleDefaults, toItemDefaults } from '@/utils/productEditorDefaults';
import { useEditorCategories } from './useEditorCategories';
import { useVariationReorder } from './useVariationReorder';
import { useCustomizationGroupsEditorState } from './useCustomizationGroupsEditorState';
import type { EditorTranslationMetadataPatch } from '@/types/translationMetadata';
import { applyEditorTranslationMetadata } from '@/utils/applyEditorTranslationMetadata';
import { useMenuSectionAuthoringState } from './useMenuSectionAuthoringState';

interface UseProductEditorFormOptions {
  product: ProductDetails;
  /** Fixed for the hook's lifetime — the page mounts the editor only once the kind is known. */
  isBundle: boolean;
  /** `create` on the /new route (empty defaults → POST), `edit` on `[productId]` (→ PUT). */
  mode?: 'create' | 'edit';
  onSaved: () => void;
}

/** Shared create/edit form for products and menu bundles in the unified admin editor. */
export function useProductEditorForm({ product, isBundle, mode = 'edit', onSaved }: UseProductEditorFormOptions) {
  const { t, i18n } = useTranslation();
  const editorDefaults = isBundle ? toBundleDefaults(product) : toItemDefaults(product);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { categories, categoriesError } = useEditorCategories(isBundle);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedSideItemIds, setSelectedSideItemIds] = useState<string[]>([]);
  const [detailedIngredients, setDetailedIngredients] = useState<ProductIngredient[]>([]);
  const customization = useCustomizationGroupsEditorState(product, isBundle);
  const menuAuthoring = useMenuSectionAuthoringState(product);
  const { menuDefinition, setMenuDefinition } = menuAuthoring;
  const [isMenuDefinitionDirty, setIsMenuDefinitionDirty] = useState(false);
  const [isIngredientsDirty, setIsIngredientsDirty] = useState(false);
  const translationMetadata = useRef<EditorTranslationMetadataPatch | null>(null);

  const schema = pickEditorSchema(isBundle, mode);
  const form = useForm<FieldValues>({
    // D13/S7. Not `onChange` (a message while the admin types the first character is noise) and
    // no longer `onSubmit` (which refused to save for a reason three screens away). A field that
    // HAS failed re-validates on change, so the message clears as it is fixed.
    mode: 'onTouched',
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    defaultValues: editorDefaults,
  });

  const { control, getValues, reset, setError, watch, setValue } = form;

  const variations = useFieldArray({ control, name: 'variations' });
  useEffect(() => {
    reset(isBundle ? toBundleDefaults(product) : toItemDefaults(product));
    setSelectedSideItemIds(isBundle ? [] : (product.suggestedSideItems ?? []).map((s) => s.id).filter(Boolean));
    setDetailedIngredients(isBundle ? [] : (product.detailedIngredients ?? []));
    setImageFiles([]);
    setIsMenuDefinitionDirty(false);
    setIsIngredientsDirty(false);
  }, [product, isBundle, reset]);

  // The editor owns this value outside react-hook-form. Mirror it so Zod validates the current menu.
  useEffect(() => {
    if (isBundle) setValue('menuDefinition', menuDefinition);
  }, [isBundle, menuDefinition, setValue]);

  useEffect(() => {
    if (!isBundle) setValue('customizationGroups', customization.groups);
  }, [customization.groups, isBundle, setValue]);

  const changeMenuDefinition = useCallback(
    (next: MenuDefinition) => {
      setMenuDefinition(next);
      setIsMenuDefinitionDirty(true);
    },
    [setMenuDefinition],
  );

  const changeSideItemIds = useCallback(
    (next: string[]) => {
      setSelectedSideItemIds(next);
      setValue('suggestedSideItemIds', next, { shouldDirty: true });
    },
    [setValue],
  );

  const changeIngredients = useCallback((next: ProductIngredient[]) => {
    setDetailedIngredients(next);
    setIsIngredientsDirty(true);
  }, []);

  const moveVariation = useVariationReorder({ getValues, setValue, variations });

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Record<string, unknown> = { ...(data as Record<string, unknown>) };

    // Section AND item AND definition ids: every `temp-…` one 400s (Guid? on the wire).
    if (isBundle) payload.menuDefinition = toSubmittableMenuDefinition(menuDefinition);

    // UpdateMenuBundleCommand / CreateMenuBundleCommand have no DetailedIngredients, so
    // anything sent here for a bundle is silently dropped — but the reconciliation still runs
    // and CREATES global ingredient rows as a side effect. Don't feed it.
    let ingredientsForKind = isBundle ? [] : detailedIngredients;
    if (translationMetadata.current) {
      const translated = applyEditorTranslationMetadata(payload, ingredientsForKind, translationMetadata.current);
      Object.assign(payload, translated.payload);
      ingredientsForKind = translated.detailedIngredients as typeof ingredientsForKind;
    }

    if (mode === 'create') {
      await submitProductForm({
        data: payload as never,
        imageFiles,
        currentLanguage: i18n.language || 'en',
        detailedIngredients: ingredientsForKind,
        customizationGroups: customization.groups,
        // 'creating' | 'uploading' | 'idle' collapses to a boolean here; on success the page
        // navigates away via onSaved, so there are no dirty flags to clear.
        setSubmissionStatus: (status) => setIsSubmitting(status !== 'idle'),
        // The product is created before its photos are; a refusal there must be SAID, and said on
        // a surface that outlives the redirect to the list. See utils/productImageFailure.
        onImageUploadFailed: (reason) => reportProductImageUploadFailure(t, 'create', reason),
        setError,
        onProductCreated: onSaved,
        onClose: () => {},
        // reset is typed for the concrete create schema; the hook holds FieldValues (four
        // structurally-different schemas share one useForm), so the boundary is cast — the
        // same `never` seam as the resolver above.
        reset: reset as never,
        setImageFiles,
        fallbackMessage: t('unexpected_error', 'An unexpected error occurred.'),
      });
      return;
    }

    await submitEditProductForm({
      data: payload as never,
      product: menuAuthoring.productForSave,
      imageFiles,
      detailedIngredients: ingredientsForKind,
      customizationGroups: customization.groups,
      setIsSubmitting,
      setError,
      onMenuSectionsPatched: menuAuthoring.onMenuSectionsPatched,
      partialMenuSaveMessage: (reason) => t('menu_sections_saved_partial', { reason }),
      onProductUpdated: () => {
        setImageFiles([]);
        setIsMenuDefinitionDirty(false);
        setIsIngredientsDirty(false);
        customization.markClean();
        onSaved();
      },
      onClose: () => {},
      fallbackMessage: t('unexpected_error', 'An unexpected error occurred.'),
      onImageUploadFailed: (reason) => reportProductImageUploadFailure(t, 'edit', reason),
    });
  });

  return {
    form,
    categories,
    categoriesError,
    currentLanguage: i18n.language || 'en',
    selectedCategoryIds: (watch('categoryIds') as string[] | undefined) ?? [],
    primaryCategoryId: (watch('primaryCategoryId') as string | undefined) ?? '',
    basePrice: (watch('basePrice') as number | undefined) ?? 0,
    variations,
    imageFiles,
    setImageFiles,
    selectedSideItemIds,
    changeSideItemIds,
    detailedIngredients,
    changeIngredients,
    isIngredientsDirty,
    customizationGroups: customization.groups,
    changeCustomizationGroups: customization.change,
    moveVariation,
    menuDefinition,
    changeMenuDefinition,
    isSubmitting,
    isDirty:
      form.formState.isDirty ||
      isMenuDefinitionDirty ||
      isIngredientsDirty ||
      customization.isDirty ||
      imageFiles.length > 0,
    onSubmit,
    setTranslationMetadata: (metadata: EditorTranslationMetadataPatch) => {
      translationMetadata.current = metadata;
    },
  };
}
