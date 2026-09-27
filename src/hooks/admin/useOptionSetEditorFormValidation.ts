'use client';

import { useCallback, useState } from 'react';
import type { LanguageCode } from '@/config/languageConfig';
import type { OptionSetEntry, OptionSetKind } from '@/types/optionSet';
import { optionSetEditorSchema } from '@/utils/optionSetEditorSchema';

interface OptionSetFormValues {
  readonly kind: OptionSetKind | '';
  readonly name: string;
  readonly sourceLocale: LanguageCode;
  readonly entries: readonly OptionSetEntry[];
}

export function useOptionSetEditorFormValidation(values: OptionSetFormValues) {
  const [submitted, setSubmitted] = useState(false);
  const valid = optionSetEditorSchema.safeParse(values).success;
  const validate = useCallback(() => {
    setSubmitted(true);
    return valid;
  }, [valid]);

  return { validate, showError: submitted && !valid };
}
