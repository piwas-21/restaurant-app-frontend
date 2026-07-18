'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { getCategories } from '@/services/categoryService';
import {
  createMenuBundleSchema,
  createProductSchema,
  editMenuBundleSchema,
  editProductSchema,
} from '@/components/admin/product/schemas';
import { submitEditProductForm, submitProductForm } from '@/components/admin/product/productFormUtils';
import type { Category } from '@/components/admin/product/types';
import type { ProductDetails, ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import { isPersistedMenuId, stripTemporaryMenuSectionIds } from '@/utils/menuSectionDraft';
import { toBundleDefaults, toItemDefaults, toMenuDefinitionState } from '@/utils/productEditorDefaults';

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
  const { i18n } = useTranslation();
  const editorDefaults = isBundle ? toBundleDefaults(product) : toItemDefaults(product);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [selectedSideItemIds, setSelectedSideItemIds] = useState<string[]>([]);
  const [detailedIngredients, setDetailedIngredients] = useState<ProductIngredient[]>([]);
  const [menuDefinition, setMenuDefinition] = useState<MenuDefinition>(() => toMenuDefinitionState(product));
  // The form's own isDirty can't see these: the schedule/sections AND the detailed
  // ingredients live outside RHF (ingredients are not a registered field), so a change to
  // either would otherwise leave Save disabled and strand the edit.
  const [isMenuDefinitionDirty, setIsMenuDefinitionDirty] = useState(false);
  const [isIngredientsDirty, setIsIngredientsDirty] = useState(false);

  // The resolver is chosen by kind + mode and never swapped. The item schema requires
  // categoryIds.min(1) + primaryCategoryId (a bundle has neither — MenuBundleDto returns no
  // categories); the bundle schema requires a menuDefinition; the create schemas add the
  // stricter server bounds a fresh row must meet. Four structurally-different schemas mean the
  // ternary widens past zodResolver's overloads with no single shape for useForm to infer —
  // hence FieldValues + a `never` cast (the modals used `as any`; `never` keeps §5.8's rule).
  const bundleSchema = mode === 'create' ? createMenuBundleSchema : editMenuBundleSchema;
  const itemSchema = mode === 'create' ? createProductSchema : editProductSchema;
  const schema = isBundle ? bundleSchema : itemSchema;
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    defaultValues: editorDefaults,
  });

  const { control, reset, setError, watch, setValue } = form;

  const variations = useFieldArray({ control, name: 'variations' });
  const content = useFieldArray({ control, name: 'content' });

  useEffect(() => {
    const load = async () => {
      const response = (await getCategories()) as { success: boolean; data?: { items?: Category[] } };
      if (response.success) setCategories(response.data?.items ?? []);
    };
    // Bundles have no category control (MenuBundleDto carries none), so don't fetch for them.
    if (isBundle) return;
    load().catch((err) => console.error('useProductEditorForm: failed to load categories', err));
  }, [isBundle]);

  useEffect(() => {
    reset(isBundle ? toBundleDefaults(product) : toItemDefaults(product));
    setSelectedSideItemIds(isBundle ? [] : (product.suggestedSideItems ?? []).map((s) => s.id).filter(Boolean));
    setDetailedIngredients(isBundle ? [] : (product.detailedIngredients ?? []));
    setMenuDefinition(toMenuDefinitionState(product));
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

  const onSubmit = form.handleSubmit(async (data) => {
    const payload: Record<string, unknown> = { ...(data as Record<string, unknown>) };

    if (isBundle) {
      // Item ids must be stripped too, not just section ids: MenuSectionItemDto.Id is Guid?,
      // so a `temp-…` id fails STJ conversion and the request 400s. The write path's inline
      // mapping only handles the section id — see toMenuDefinitionPayload's docstring.
      const definition: Record<string, unknown> = {
        ...menuDefinition,
        sections: stripTemporaryMenuSectionIds(menuDefinition.sections),
      };
      // A temp definition id would 400 the same way; the backend assigns one.
      if (!isPersistedMenuId(menuDefinition.id)) delete definition.id;
      payload.menuDefinition = definition;
    }

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
        // submitProductForm reports 'creating' | 'uploading' | 'idle'; the page only needs a
        // boolean. On success it navigates away via onSaved, so no dirty flags to clear here.
        setSubmissionStatus: (status) => setIsSubmitting(status !== 'idle'),
        setError,
        onProductCreated: onSaved,
        onClose: () => {},
        // reset is typed for the concrete create schema; the hook holds FieldValues (four
        // structurally-different schemas share one useForm), so the boundary is cast — the
        // same `never` seam as the resolver above.
        reset: reset as never,
        setImageFiles,
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
    });
  });

  return {
    form,
    categories,
    currentLanguage: i18n.language || 'en',
    selectedCategoryIds: (watch('categoryIds') as string[] | undefined) ?? [],
    basePrice: (watch('basePrice') as number | undefined) ?? 0,
    variations,
    content,
    imageFiles,
    setImageFiles,
    selectedSideItemIds,
    changeSideItemIds,
    detailedIngredients,
    changeIngredients,
    menuDefinition,
    changeMenuDefinition,
    isSubmitting,
    isDirty: form.formState.isDirty || isMenuDefinitionDirty || isIngredientsDirty,
    onSubmit,
  };
}
