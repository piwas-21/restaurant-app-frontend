'use client';

import React from 'react';
import { Controller } from 'react-hook-form';
import type { TFunction } from 'i18next';
import { ProductBasicInfo } from '@/components/admin/product/ProductBasicInfo';
import { ProductDetails as ProductDetailsFields } from '@/components/admin/product/ProductDetails';
import { MultilingualContent } from '@/components/admin/product/MultilingualContent';
import { ProductVariations } from '@/components/admin/product/ProductVariations';
import { SuggestedSideItemsPicker } from '@/components/admin/product/SuggestedSideItemsPicker';
import { ProductIngredientsManager } from '@/components/admin/product/ProductIngredientsManager';
import ProductOrderTypes from '@/components/admin/product/ProductOrderTypes';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import BundlePanel from './BundlePanel';
import ImageGallery from './ImageGallery';
import type { EditorSection } from './EditorShell';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

/**
 * The editor's section list (MENU-ITEM-EDITOR-REDESIGN-PLAN slice S1).
 *
 * S1 is a SHELL slice: every section below is today's component, dropped in unchanged, in today's
 * order. Nothing is re-grouped, renamed or moved between sections here — that is S2, and keeping
 * them apart is what lets the owner veto the new layout without any field semantics having moved.
 *
 * It lives in its own file because `ProductEditorPage` has 4 LOC of headroom against the 250-LOC
 * gate, and because the shell must not learn what a product field is.
 */
export interface EditorSectionsContext {
  readonly editor: ReturnType<typeof useProductEditorForm>;
  readonly t: TFunction;
  readonly product: ProductDetails;
  readonly isCreate: boolean;
  readonly isBundle: boolean;
}

/** Section ids are DOM ids — the nav scrolls to them. */
export const SECTION_IDS = {
  media: 'editor-section-media',
  basics: 'editor-section-basics',
  variations: 'editor-section-variations',
  sides: 'editor-section-sides',
  ingredients: 'editor-section-ingredients',
  service: 'editor-section-service',
} as const;

/**
 * Images stay FIRST on edit and OUTSIDE the form (Track F, F7-B/C) — see
 * `EditorSection.outsideForm` for why nesting them would turn "delete this image → Yes" into a
 * product save. Not on create: there is no product id to POST against, so that route keeps the
 * staged file input in Details. Not on a bundle either: pre-existing gap, frontend #524.
 */
function mediaSection({ t, product }: EditorSectionsContext): EditorSection {
  return {
    id: SECTION_IDS.media,
    label: t('image_gallery'),
    outsideForm: true,
    node: <ImageGallery productId={product.id} images={product.images || []} productName={product.name} />,
  };
}

function itemSections(context: EditorSectionsContext): EditorSection[] {
  const { editor, t, isCreate } = context;
  const { form } = editor;
  const { errors } = form.formState;

  return [
    ...(isCreate ? [] : [mediaSection(context)]),
    {
      id: SECTION_IDS.basics,
      label: t('editor_section_basics'),
      // The only item section whose content brings no heading of its own: it is two columns of bare
      // fields. Every other one renders an <h3> or a <legend>, so a shell heading would double it.
      showHeading: true,
      node: (
        <div className={modalStyles.formGrid}>
          <ProductBasicInfo
            register={form.register}
            errors={errors}
            categories={editor.categories}
            categoriesError={editor.categoriesError}
            selectedCategoryIds={editor.selectedCategoryIds}
            control={form.control}
          />
          <ProductDetailsFields
            register={form.register}
            errors={errors}
            control={form.control}
            imageFiles={editor.imageFiles}
            setImageFiles={editor.setImageFiles}
            showImagePicker={isCreate}
          />
        </div>
      ),
    },
    {
      id: SECTION_IDS.variations,
      label: t('variations'),
      node: (
        <ProductVariations
          register={form.register}
          errors={errors}
          variationFields={editor.variations.fields}
          appendVariation={editor.variations.append}
          removeVariation={editor.variations.remove}
        />
      ),
    },
    {
      id: SECTION_IDS.sides,
      label: t('suggested_side_items'),
      node: (
        <SuggestedSideItemsPicker
          control={form.control}
          errors={errors}
          selectedSideItemIds={editor.selectedSideItemIds}
          onChange={editor.changeSideItemIds}
        />
      ),
    },
    {
      id: SECTION_IDS.ingredients,
      label: t('product_ingredients'),
      node: (
        <ProductIngredientsManager
          ingredients={editor.detailedIngredients}
          onChange={editor.changeIngredients}
          productBasePrice={editor.basePrice}
        />
      ),
    },
  ];
}

function bundleSections({ editor, t }: EditorSectionsContext): EditorSection[] {
  const { form } = editor;
  return [
    {
      id: SECTION_IDS.basics,
      label: t('details'),
      node: (
        <BundlePanel
          register={form.register}
          errors={form.formState.errors}
          menuDefinition={editor.menuDefinition}
          onChange={editor.changeMenuDefinition}
          imageFiles={editor.imageFiles}
          setImageFiles={editor.setImageFiles}
        />
      ),
    },
  ];
}

/**
 * Shared by both kinds since §9.2 — bundle commands accept and store a mask, so the control no
 * longer promises a save that silently does nothing. A bundle inherits nothing in practice (this
 * editor has no category control), which is why the field is the ONLY way to restrict a combo.
 */
function orderTypesSection({ editor, t, isBundle }: EditorSectionsContext): EditorSection {
  const { form } = editor;
  return {
    id: SECTION_IDS.service,
    label: t('product_order_types'),
    node: (
      <Controller
        name="availableOrderTypes"
        control={form.control}
        render={({ field }) => (
          <ProductOrderTypes
            value={(field.value as number | null | undefined) ?? null}
            onChange={field.onChange}
            categories={editor.categories}
            primaryCategoryId={editor.primaryCategoryId}
            isBundle={isBundle}
            error={form.formState.errors.availableOrderTypes?.message as string | undefined}
          />
        )}
      />
    ),
  };
}

export function buildEditorSections(context: EditorSectionsContext): EditorSection[] {
  const own = context.isBundle ? bundleSections(context) : itemSections(context);
  return [...own, orderTypesSection(context)];
}

/**
 * The `Translations` tab's body (D2). S1 relocates today's multilingual list here unchanged — it is
 * the same component over the same `content` field array, so the payload is byte-identical. The one
 * locale switcher that also retargets variation and ingredient names, and the deletion of the two
 * per-row `<details>` blocks, is S4.
 */
export function buildTranslationsPanel({ editor, t }: EditorSectionsContext): React.ReactNode {
  const { form } = editor;
  return (
    <section aria-label={t('multilingual_content')}>
      <MultilingualContent
        register={form.register}
        errors={form.formState.errors}
        control={form.control}
        contentFields={editor.content.fields}
        appendContent={editor.content.append}
        removeContent={editor.content.remove}
        watch={form.watch}
        currentLanguage={editor.currentLanguage}
      />
    </section>
  );
}
