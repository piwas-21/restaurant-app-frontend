'use client';

import { useCallback, useEffect, useState } from 'react';
import { useFieldArray, useForm, type FieldValues, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { getCategories } from '@/services/categoryService';
import { editMenuBundleSchema, editProductSchema } from '@/components/admin/product/schemas';
import { submitEditProductForm } from '@/components/admin/product/productFormUtils';
import type { Category } from '@/components/admin/product/types';
import type { ProductDetails, ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import { isPersistedMenuId, stripTemporaryMenuSectionIds } from '@/utils/menuSectionDraft';
import { toEditorDefaults, toMenuDefinitionState } from '@/utils/productEditorDefaults';

interface UseProductEditorFormOptions {
  product: ProductDetails;
  /** Fixed for the hook's lifetime — the page mounts the editor only once the kind is known. */
  isBundle: boolean;
  onSaved: () => void;
}

/**
 * The unified admin editor's form (menu-bundles redesign #176, slice 7 PR2d): one
 * react-hook-form + Zod instance and ONE write path, replacing the modal's form and the
 * self-saving detail tables' second write path (owner call, plan §7).
 */
export function useProductEditorForm({ product, isBundle, onSaved }: UseProductEditorFormOptions) {
  const { i18n } = useTranslation();
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

  // The resolver is chosen by kind and never swapped. editProductSchema REQUIRES
  // categoryIds.min(1) + primaryCategoryId, which a bundle can never satisfy — its form has
  // no category field and MenuBundleDto returns none — so a single resolver would make every
  // bundle unsubmittable. editMenuBundleSchema conversely requires a menuDefinition.
  // The two schemas are structurally different, so the ternary widens to a union that
  // zodResolver's overloads reject, and there is no single static shape for useForm to infer
  // — hence FieldValues (the panels already take register/errors/control untyped). The
  // modals cast the same boundary with `as any`; `never` keeps §5.8's no-any rule.
  const form = useForm<FieldValues>({
    resolver: zodResolver((isBundle ? editMenuBundleSchema : editProductSchema) as never) as Resolver<FieldValues>,
    defaultValues: toEditorDefaults(product, isBundle),
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
    reset(toEditorDefaults(product, isBundle));
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

    await submitEditProductForm({
      data: payload as never,
      product,
      imageFiles,
      // UpdateMenuBundleCommand has no DetailedIngredients, so anything sent here for a
      // bundle is silently dropped — but the reconciliation still runs and CREATES global
      // ingredient rows as a side effect. Don't feed it.
      detailedIngredients: isBundle ? [] : detailedIngredients,
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
