'use client';

import type { TFunction } from 'i18next';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import {
  collectErrorFields,
  focusField,
  isTranslationsField,
  sectionIdsWithErrors,
} from '@/components/admin/product-editor/editorValidation';
import type { EditorSection } from '@/components/admin/product-editor/EditorShell';

interface UseEditorErrorsOptions {
  errors: FieldErrors<FieldValues>;
  t: TFunction;
  /** The editor's tab setter — a translation error is only reachable on the other tab. */
  setActiveTab: (id: string) => void;
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
export function useEditorErrors({ errors, t, setActiveTab, itemTabId, translationsTabId }: UseEditorErrorsOptions) {
  // `errors.root` is the FORM-level message: it already renders above the sections and has no
  // input, so counting it would offer a jump to nowhere. `collectErrorFields` drops it.
  const fields = collectErrorFields(errors);
  const sectionIds = new Set(sectionIdsWithErrors(fields));

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
    const first = fields[0];
    if (!first) return;
    if (isTranslationsField(first.name)) {
      setActiveTab(translationsTabId);
      setTimeout(() => focusField(first.name), 0);
      return;
    }
    setActiveTab(itemTabId);
    focusField(first.name);
  };

  return {
    count: fields.length,
    label: t('editor_error_summary', { count: fields.length }),
    decorate,
    jumpToFirst,
  };
}

export default useEditorErrors;
