'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm, type FieldErrors, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { pickEditorSchema } from '@/components/admin/product/schemas';
import { submitEditProductForm, submitProductForm } from '@/components/admin/product/productFormUtils';
import type { ProductDetails, ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import { toSubmittableMenuDefinition } from '@/utils/menuSectionDraft';
import { reportProductImageUploadFailure } from '@/utils/productImageFailure';
import { toBundleDefaults, toItemDefaults, toMenuDefinitionState } from '@/utils/productEditorDefaults';
import { collectErrorFields, jumpToField } from '@/components/admin/product-editor/editorValidation';
import { useEditorCategories } from './useEditorCategories';
import { useVariationReorder } from './useVariationReorder';

interface UseProductEditorFormOptions {
  product: ProductDetails;
  /** Fixed for the hook's lifetime — the page mounts the editor only once the kind is known. */
  isBundle: boolean;
  /** `create` on the /new route (empty defaults → POST), `edit` on `[productId]` (→ PUT). */
  mode?: 'create' | 'edit';
  onSaved: () => void;
}

/**
 * The unified admin editor's form (menu-bundles redesign #176, slice 7): one
 * react-hook-form + Zod instance and ONE product write path, replacing the four modals'
 * forms and the self-saving detail tables' second write path (owner call, plan §7). It
 * drives both the create (`/new`) and edit (`[productId]`) routes — the kind and the mode
 * pick the schema and the endpoint.
 */
export function useProductEditorForm({ product, isBundle, mode = 'edit', onSaved }: UseProductEditorFormOptions) {
  const { t, i18n } = useTranslation();
  const editorDefaults = isBundle ? toBundleDefaults(product) : toItemDefaults(product);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // The list AND the reason it is missing. A failed category fetch used to be a console.error and
  // an empty control — see useEditorCategories.
  const { categories, categoriesError } = useEditorCategories(isBundle);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedSideItemIds, setSelectedSideItemIds] = useState<string[]>([]);
  const [detailedIngredients, setDetailedIngredients] = useState<ProductIngredient[]>([]);
  const [menuDefinition, setMenuDefinition] = useState<MenuDefinition>(() => toMenuDefinitionState(product));
  // The form's own isDirty can't see these: the schedule/sections AND the detailed
  // ingredients live outside RHF (ingredients are not a registered field), so a change to
  // either would otherwise leave Save disabled and strand the edit.
  const [isMenuDefinitionDirty, setIsMenuDefinitionDirty] = useState(false);
  const [isIngredientsDirty, setIsIngredientsDirty] = useState(false);

  // `FieldValues` + a `never` cast, because the four schemas have no single shape for `useForm` to
  // infer — see `pickEditorSchema`, which owns that choice. (The modals used `as any`.)
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
  // No `useFieldArray` for `content` since S4: the workbench addresses a locale by CODE, not by row
  // index, so a field array would be a rival owner whose `fields` go stale on every pruned row.

  useEffect(() => {
    reset(isBundle ? toBundleDefaults(product) : toItemDefaults(product));
    setSelectedSideItemIds(isBundle ? [] : (product.suggestedSideItems ?? []).map((s) => s.id).filter(Boolean));
    setDetailedIngredients(isBundle ? [] : (product.detailedIngredients ?? []));
    setMenuDefinition(toMenuDefinitionState(product));
    setImageFiles([]);
    setIsMenuDefinitionDirty(false);
    setIsIngredientsDirty(false);
  }, [product, isBundle, reset]);

  // Mirror the schedule/sections state back into the form. editMenuBundleSchema REQUIRES
  // menuDefinition, and the editors below are not registered fields — without this the
  // resolver would validate a stale value and silently refuse to submit.
  useEffect(() => {
    if (isBundle) setValue('menuDefinition', menuDefinition);
  }, [isBundle, menuDefinition, setValue]);

  const changeMenuDefinition = useCallback((next: MenuDefinition) => {
    setMenuDefinition(next);
    setIsMenuDefinitionDirty(true);
  }, []);

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

  /** #593: reorder AND renumber. `useVariationReorder` states why `move` alone is not enough. */
  const moveVariation = useVariationReorder({ getValues, setValue, variations });

  // A refused submit jumps to the first failing field (D13). Without it the only signal is a Save
  // that appears to do nothing, which on a seven-section form reads as a broken button. The save
  // bar's chip then says how many remain; this is that same jump, fired automatically.
  const onInvalidSubmit = (submitErrors: FieldErrors<FieldValues>) => {
    const first = collectErrorFields(submitErrors)[0];
    if (first) jumpToField(first.name);
  };

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Record<string, unknown> = { ...(data as Record<string, unknown>) };

    // Section AND item AND definition ids: every `temp-…` one 400s (Guid? on the wire).
    if (isBundle) payload.menuDefinition = toSubmittableMenuDefinition(menuDefinition);

    // UpdateMenuBundleCommand / CreateMenuBundleCommand have no DetailedIngredients, so
    // anything sent here for a bundle is silently dropped — but the reconciliation still runs
    // and CREATES global ingredient rows as a side effect. Don't feed it.
    const ingredientsForKind = isBundle ? [] : detailedIngredients;

    if (mode === 'create') {
      await submitProductForm({
        data: payload as never,
        imageFiles,
        currentLanguage: i18n.language || 'en',
        detailedIngredients: ingredientsForKind,
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
      product,
      imageFiles,
      detailedIngredients: ingredientsForKind,
      setIsSubmitting,
      setError,
      onProductUpdated: () => {
        setImageFiles([]);
        setIsMenuDefinitionDirty(false);
        setIsIngredientsDirty(false);
        onSaved();
      },
      onClose: () => {},
      fallbackMessage: t('unexpected_error', 'An unexpected error occurred.'),
      onImageUploadFailed: (reason) => reportProductImageUploadFailure(t, 'edit', reason),
    });
  }, onInvalidSubmit);

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
    moveVariation,
    menuDefinition,
    changeMenuDefinition,
    isSubmitting,
    // `imageFiles` counts too (frontend #223): staged uploads live outside RHF, so picking images
    // and changing nothing else left Save disabled and the upload unreachable.
    isDirty: form.formState.isDirty || isMenuDefinitionDirty || isIngredientsDirty || imageFiles.length > 0,
    onSubmit,
  };
}
