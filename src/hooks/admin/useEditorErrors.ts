'use client';

import { useEffect, useRef } from 'react';
import type { TFunction } from 'i18next';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import {
  collectErrorFields,
  isTranslationsField,
  jumpToField,
  sectionForField,
  sectionIdsWithErrors,
} from '@/components/admin/product-editor/editorValidation';
import type { EditorSection } from '@/components/admin/product-editor/EditorShell';

interface UseEditorErrorsOptions {
  errors: FieldErrors<FieldValues>;
  submitCount: number;
  t: TFunction;
  /** The editor's tab setter — a translation error is only reachable on the other tab. */
  setActiveTab: (id: string) => void;
  /** The focused section setter — item errors can now live in hidden tabpanels. */
  setActiveSection: (id: string) => void;
  sections: readonly EditorSection[];
  /** Bundle allergens live in Basics, while item allergens live in Recipe & dietary. */
  isBundle: boolean;
  itemTabId: string;
  translationsTabId: string;
}

/**
 * D13's error surface, derived from react-hook-form's error tree (slice S7).
 *
 * A hook rather than four expressions inside `ProductEditorPage`, for a measured reason: that file
 * sits on Sonar's `cognitive-complexity` ceiling — a sibling slice pushed it from 15 to 17 and CI
 * went red — and it is an ORCHESTRATOR. Deciding which nav entry earns a marker is not orchestration.
 *
 * It holds NO state and memoises nothing, deliberately. Every value here is a pure read of `errors`
 * plus one DOM move; the two functions are called during the same render that produced them, so a
 * `useCallback` would buy an identity nobody compares and cost a dependency array that cannot be
 * expressed honestly (the section set is rebuilt every render by definition).
 */
export function useEditorErrors({
  errors,
  submitCount,
  t,
  setActiveTab,
  setActiveSection,
  sections,
  isBundle,
  itemTabId,
  translationsTabId,
}: UseEditorErrorsOptions) {
  // `errors.root` is the FORM-level message: it already renders above the sections and has no
  // input, so counting it would offer a jump to nowhere. `collectErrorFields` drops it.
  const fields = collectErrorFields(errors);
  const sectionIds = new Set(sectionIdsWithErrors(fields, isBundle));
  const first = fields[0];
  const firstSection =
    first && !isTranslationsField(first.name)
      ? sections.find((section) => section.id === sectionForField(first.name, isBundle))
      : undefined;
  const firstLocation = first && isTranslationsField(first.name) ? t('editor_tab_translations') : firstSection?.label;
  const label =
    fields.length > 0 && firstLocation
      ? t('editor_error_summary_in_section', { count: fields.length, section: firstLocation })
      : t('editor_error_summary', { count: fields.length });
  const lastSubmitCount = useRef(submitCount);

  useEffect(() => {
    if (submitCount === lastSubmitCount.current) return;
    lastSubmitCount.current = submitCount;
    const firstError = fields[0];
    if (!firstError) return;

    if (isTranslationsField(firstError.name)) {
      setActiveTab(translationsTabId);
    } else {
      setActiveTab(itemTabId);
      const sectionId = sectionForField(firstError.name, isBundle);
      if (sectionId) setActiveSection(sectionId);
    }
    setTimeout(() => jumpToField(firstError.name, isBundle), 0);
  }, [fields, isBundle, itemTabId, setActiveSection, setActiveTab, submitCount, translationsTabId]);

  /** Mark the sections holding an error, for the nav's `!` (conformance gap G3, issue #579). */
  const decorate = (sections: readonly EditorSection[]): EditorSection[] =>
    sections.map((section) =>
      sectionIds.has(section.id) ? { ...section, hasError: true, errorLabel: t('editor_section_has_errors') } : section,
    );

  /*
   * Jump to the first failing field. A translation row lives in the OTHER tab, which is `hidden`
   * and therefore unfocusable, so the tab is switched first and the focus deferred by a tick. The
   * panel is only mounted-and-hidden, never unmounted (§8.1), so the error survives the switch.
   */
  const jumpToFirst = () => {
    const firstError = fields[0];
    if (!firstError) return;
    if (isTranslationsField(firstError.name)) {
      setActiveTab(translationsTabId);
      setTimeout(() => jumpToField(firstError.name, isBundle), 0);
      return;
    }
    setActiveTab(itemTabId);
    const sectionId = sectionForField(firstError.name, isBundle);
    if (sectionId) setActiveSection(sectionId);
    setTimeout(() => jumpToField(firstError.name, isBundle), 0);
  };

  return {
    count: fields.length,
    label,
    decorate,
    jumpToFirst,
  };
}

export default useEditorErrors;
