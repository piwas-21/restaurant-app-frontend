'use client';

import React from 'react';
import { MultilingualContent } from '@/components/admin/product/MultilingualContent';
import BundlePanel from './BundlePanel';
import EditorOrderTypesField from './EditorOrderTypesField';
import { buildItemSections } from './itemEditorSections';
import { SECTION_IDS, type EditorSectionsContext } from './editorSectionTypes';
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
 */
function bundleSections(context: EditorSectionsContext): EditorSection[] {
  const { editor, t } = context;
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
    {
      id: SECTION_IDS.service,
      label: t('editor_section_service'),
      showHeading: true,
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
