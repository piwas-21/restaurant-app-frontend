'use client';

import { useCallback, useMemo } from 'react';
import type { LanguageCode } from '@/config/languageConfig';
import type { useOptionSetEditor } from './useOptionSetEditor';
import { useLocalizedOwnerTranslationReview } from './useLocalizedOwnerTranslationReview';

type Editor = ReturnType<typeof useOptionSetEditor>;

export function useOptionSetTranslationReview(editor: Editor, isOpen: boolean) {
  const fields = useMemo(
    () => [
      {
        fieldKey: 'name' as const,
        fieldLabel: 'option_set_name' as const,
        sourceText: editor.name,
        translations: editor.translations,
      },
    ],
    [editor.name, editor.translations],
  );
  const setTranslation = editor.setTranslation;
  const applyReviewedTranslations = useCallback(
    (
      changes: readonly { fieldRef: { entityType: string; fieldKey: string }; locale: LanguageCode; text: string }[],
    ) => {
      changes.forEach((change) => {
        if (change.fieldRef.entityType === 'optionSet' && change.fieldRef.fieldKey === 'name') {
          setTranslation(change.locale, change.text);
        }
      });
    },
    [setTranslation],
  );

  return useLocalizedOwnerTranslationReview({
    isOpen,
    entityType: 'optionSet',
    entityId: editor.detail?.id,
    clientKey: 'option-set:draft', // pragma: allowlist secret -- stable unsaved option-set identity
    sourceLocale: editor.sourceLocale,
    fields,
    expectedContentVersion: editor.detail?.translationMetadata?.expectedContentVersion,
    onApply: applyReviewedTranslations,
  });
}
