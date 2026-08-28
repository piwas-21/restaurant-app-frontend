'use client';

import React from 'react';
import { MultilingualContent } from '@/components/admin/product/MultilingualContent';
import BundlePanel from './BundlePanel';
import EditorOrderTypesField from './EditorOrderTypesField';
import { buildItemSections } from './itemEditorSections';
import { SECTION_IDS, type EditorSectionsContext } from './editorSectionTypes';
import mediaStyles from './EditorMedia.module.css';
import type { EditorSection } from './EditorShell';

/**
 * The editor's section list (MENU-ITEM-EDITOR-REDESIGN-PLAN slices S1 + S2).
 *
 * S1 dropped today's nine flat groups into the new shell unchanged; **S2 re-groups them into §4's
 * seven named sections** and changes nothing else — no field is added, renamed or removed, and the
 * PUT payload is byte-identical. The item shape lives in `itemEditorSections.tsx`; this file is the
 * dispatcher, and the bundle's own two sections.
 *
 * It stays out of `ProductEditorPage` because that page has to remain an orchestrator under the
 * 200-LOC gate, and out of `EditorShell` because the shell must never learn what a product field is.
 */
export type { EditorSectionsContext } from './editorSectionTypes';
export { SECTION_IDS } from './editorSectionTypes';

/**
 * A bundle is NOT re-grouped by S2, and that is a decision rather than an omission: §4's item
 * sections are built from controls `MenuBundleDto` does not carry (no categories, allergens,
 * kitchen type, variations or ingredients), so a combo keeps the single `BundlePanel` its data
 * supports plus the order-type mask. §4's "Composition" variant is a later slice.
 *
 * S6 adds the third: **Media, present and empty** (D11 / D5). See the section itself for why an
 * empty card beats a missing one, and why its sentence is not the approved screen's.
 */
function bundleSections(context: EditorSectionsContext): EditorSection[] {
  const { editor, t } = context;
  const { form } = editor;

  return [
    {
      id: SECTION_IDS.basics,
      // No heading and no description: `BundlePanel` brings its own `<h2>`, and a description under
      // a title that is not there would float. The bundle's five-section nav is #580, not #573.
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
    {
      id: SECTION_IDS.media,
      label: t('editor_section_media'),
      showHeading: true,
      description: t('editor_section_media_description'),
      /*
       * EMPTY WITH A REASON, not filtered out (D11, slice S6). A bundle has no gallery — issue
       * #524 — so there is nothing to render here, and hiding the card was the tempting move.
       * It is the wrong one on a REACHABLE path: the sticky nav is built from this list, so a
       * missing section shortens the nav and leaves the admin unable to tell "no photos yet"
       * from "photos are not a thing here". The only legitimate `filter()` in this feature is
       * `itemEditorSections.tsx`'s unsaved-item guard, and it is legitimate because D3 made that
       * state unreachable.
       *
       * ⚠️ THE SENTENCE IS DELIBERATELY NOT THE APPROVED SCREEN'S. The screen
       * (`admin_bundle_editor_pizza_menu`) reads "Photos are not available for menu bundles yet",
       * which is FALSE against the code — a bundle CAN have a photo today:
       *   - `BundlePanel.tsx:96` renders a `StagedImagePicker` labelled `menu_image` for EVERY
       *     bundle, which is the field this copy points at;
       *   - `admin/product/productFormUtils.ts:411-414` uploads those staged files on the UPDATE
       *     path — the branch a bundle takes to `updateMenuBundle` — via `uploadBulkProductImages`;
       *   - backend `UploadMultipleProductImagesCommand.cs:66-68` looks the id up in `Products`
       *     on `Id` and `!IsDeleted` with NO type filter, and a bundle IS a Product (`Type=Menu`)
       *     whose `MenuBundleDto` carries `List<ProductImageDto> Images`.
       * What a bundle cannot do is MANAGE its photos — set primary, reorder, delete — because it
       * has no gallery. So the copy says "photo MANAGEMENT", and points at the field that works.
       * Do not edit it back toward the picture; #524 is what makes it obsolete, and when a bundle
       * gallery ships this whole branch is replaced by `<ImageGallery … />`.
       */
      node: <p className={mediaStyles.bundleUnavailable}>{t('editor_media_bundle_unavailable')}</p>,
    },
    {
      id: SECTION_IDS.service,
      label: t('editor_section_service'),
      showHeading: true,
      description: t('editor_section_service_description'),
      node: <EditorOrderTypesField context={context} />,
    },
  ];
}

export function buildEditorSections(context: EditorSectionsContext): EditorSection[] {
  return context.isBundle ? bundleSections(context) : buildItemSections(context);
}

/**
 * The `Translations` tab's body (D2). S1 relocated today's multilingual list here unchanged — same
 * component, same `content` field array, byte-identical payload — and S2 does not touch it. The one
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
