'use client';

import React from 'react';
import TranslationsWorkbench from './translations/TranslationsWorkbench';
import BundlePanel from './BundlePanel';
import BundleMediaPanel from './BundleMediaPanel';
import ImageGallery from './ImageGallery';
import EditorOrderTypesField from './EditorOrderTypesField';
import OfferVersionsSection from './OfferVersionsSection';
import { buildItemSections } from './itemEditorSections';
import { SECTION_IDS, type EditorSectionsContext } from './editorSectionTypes';
import type { EditorSection } from './EditorShell';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';

/**
 * The editor's section list (MENU-ITEM-EDITOR-REDESIGN-PLAN slices S1 + S2).
 *
 * S1 dropped today's nine flat groups into the new shell unchanged; **S2 re-groups them into §4's
 * seven named sections** and changes nothing else — no field is added, renamed or removed, and the
 * PUT payload is byte-identical. The item shape lives in `itemEditorSections.tsx`; this file is the
 * dispatcher, and the bundle's focused sections.
 *
 * It stays out of `ProductEditorPage` because that page has to remain an orchestrator under the
 * 200-LOC gate, and out of `EditorShell` because the shell must never learn what a product field is.
 */
export type { EditorSectionsContext } from './editorSectionTypes';
export { SECTION_IDS } from './editorSectionTypes';

/**
 * A bundle uses the fields its DTO supports: bundle identity, availability, allergens and menu
 * sections. It does not share item-only kitchen, variation, ingredient or customization controls.
 * Its guest choices, schedule and local review fields use focused panels while retaining one Save.
 *
 * Media holds the same managed gallery an item gets. Since 2026-09-10 it holds the
 * SAME managed gallery an item gets: `MenuBundleDto` DOES carry `images` (they are ProductImages
 * on the bundle's product row, served by `GET /api/Menus/{id}` and managed by the same
 * `/api/Products/{id}/images...` sub-resources) — the staged-only panel this section used to
 * render was built on the assumption that it carries none, which is why an admin with five
 * uploaded photos opened the editor and saw an empty Media section with nothing to remove or
 * replace. A saved bundle edits its photos exactly like an item; the staged picker survives on
 * the CREATE route only, where there is no product id to upload against yet.
 */
function bundleSections(context: EditorSectionsContext): EditorSection[] {
  const { editor, t, product, onNavigate } = context;
  const { form } = editor;
  const bundleProps = {
    register: form.register,
    errors: form.formState.errors,
    control: form.control,
    setValue: form.setValue,
    categories: editor.categories,
    categoriesError: editor.categoriesError,
    selectedCategoryIds: editor.selectedCategoryIds,
    menuDefinition: editor.menuDefinition,
    availability: product.availability,
    productId: product.id,
    isDirty: editor.isDirty,
    isActive: Boolean(form.watch('isActive')),
    isAvailable: Boolean(form.watch('isAvailable')),
    onChange: editor.changeMenuDefinition,
  };

  const sections: EditorSection[] = [
    {
      id: SECTION_IDS.basics,
      label: t('editor_section_basics'),
      showHeading: true,
      description: t('editor_section_basics_description'),
      node: <BundlePanel {...bundleProps} section="basics" />,
    },
    {
      id: SECTION_IDS.media,
      label: t('editor_section_media'),
      showHeading: true,
      description: t('editor_section_media_description'),
      /*
       * The section keeps its place in the nav either way — the nav is built from this list, so
       * a missing section would shorten it and leave the admin unable to tell "no photos yet"
       * from "photos are not a thing here".
       *
       * A SAVED bundle gets the real gallery — the same swap S3 made for items, working the same
       * product-image sub-resources (`/api/Products/{id}/images...`); a bundle IS a product row,
       * so set-primary, reorder, delete and upload all answer for it (2026-09-10 partner
       * feedback: five uploaded photos, Media looked empty, nothing removable). Only the CREATE
       * route — no product id yet — keeps `BundleMediaPanel`, the staged picker whose files ride
       * the page's Save (see `BundleMediaPanel`).
       */
      node: product.id ? (
        <ImageGallery productId={product.id} images={product.images || []} productName={product.name} />
      ) : (
        <BundleMediaPanel files={editor.imageFiles} onChange={editor.setImageFiles} />
      ),
    },
    {
      id: SECTION_IDS.options,
      label: t('editor_bundle_options_label'),
      showHeading: true,
      description: t('editor_bundle_options_description'),
      node: <BundlePanel {...bundleProps} section="options" />,
    },
    {
      id: SECTION_IDS.service,
      label: t('editor_section_service'),
      showHeading: true,
      description: t('editor_bundle_service_description'),
      node: (
        <>
          <BundlePanel {...bundleProps} section="service" />
          <EditorOrderTypesField context={context} />
        </>
      ),
    },
  ];

  if (product.id) {
    sections.push({
      id: SECTION_IDS.advanced,
      label: t('editor_section_advanced'),
      showHeading: true,
      description: t('editor_bundle_advanced_description'),
      node: (
        <OfferVersionsSection
          product={product}
          onCreateRequested={context.onOfferCreateRequested}
          onNavigate={onNavigate}
          allowQuickCreate={false}
        />
      ),
    });
  }

  return sections;
}

export function buildEditorSections(context: EditorSectionsContext): EditorSection[] {
  return context.isBundle ? bundleSections(context) : buildItemSections(context);
}

/**
 * The `Translations` tab's body (D2), and since S4 the ONLY translation surface in the editor.
 *
 * S1 relocated today's multilingual row list here unchanged, because an empty tab is not shippable;
 * S4 replaces it. One locale switcher now retargets the product's, every variation's and every
 * ingredient's strings at once, and the two per-row `<details>` grids are deleted — three UIs for
 * one concept was the mess the owner complained about, not merely three stylesheets.
 */
export function buildTranslationsPanel(
  { editor, sourceLocaleFor, sourceLocaleKnownFor, onSourceLocaleChange }: EditorSectionsContext,
  reviewControls?: {
    readonly review: ReturnType<typeof useEditorTranslationReview>;
    readonly isOpen: boolean;
    readonly onToggle: () => void;
    readonly onApply: () => Promise<void>;
  },
): React.ReactNode {
  return (
    <TranslationsWorkbench
      editor={editor}
      sourceLocaleFor={sourceLocaleFor}
      sourceLocaleKnownFor={sourceLocaleKnownFor}
      onSourceLocaleChange={onSourceLocaleChange}
      reviewControls={reviewControls}
    />
  );
}
