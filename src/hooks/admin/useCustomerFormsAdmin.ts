'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import { formFieldConfigService } from '@/services/formFieldConfigService';
import { invalidateFormFieldConfigCache } from '@/hooks/useCustomerFormFields';
import type { FormFieldConfigurationDto, FormFieldsDto } from '@/types/formFieldConfig';

/**
 * The admin-facing 3-state of one configurable field. `required` implies
 * visible and `hidden` implies not required, so the backend's invalid
 * "required but hidden" combination is unrepresentable in the UI.
 */
export type FieldTriState = 'hidden' | 'optional' | 'required';

export function toTriState(field: Pick<FormFieldConfigurationDto, 'isVisible' | 'isRequired'>): FieldTriState {
  if (!field.isVisible) return 'hidden';
  return field.isRequired ? 'required' : 'optional';
}

export function fromTriState(state: FieldTriState): { isVisible: boolean; isRequired: boolean } {
  return { isVisible: state !== 'hidden', isRequired: state === 'required' };
}

/**
 * State + actions for the admin "Customer forms" page: loads the grouped
 * configuration, tracks per-field 3-state edits (locked fields are immutable),
 * and saves one whole form at a time (locked fields echoed unchanged — the
 * backend tolerates that, so whole-form submits work).
 */
export function useCustomerFormsAdmin() {
  const { t } = useTranslation();
  const [forms, setForms] = useState<FormFieldsDto[]>([]);
  const [savedForms, setSavedForms] = useState<FormFieldsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFormKey, setSavingFormKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await formFieldConfigService.getAll();
        if (cancelled) return;
        setForms(data);
        setSavedForms(data);
      } catch {
        if (!cancelled) {
          enqueueSnackbar(t('customer_forms_load_failed', 'Failed to load the customer form settings'), {
            variant: 'error',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only initial fetch (sibling convention: OrderTypeManager). `t` is
    // deliberately omitted — a refetch on a `t` identity change (e.g. language
    // switch) would clobber the admin's in-progress, unsaved edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Applies a 3-state change to one configurable field. Locked fields are ignored. */
  const setFieldState = (formKey: string, fieldKey: string, state: FieldTriState) => {
    setForms((prev) =>
      prev.map((form) => {
        if (form.formKey !== formKey) return form;
        return {
          ...form,
          fields: form.fields.map((field) =>
            field.fieldKey === fieldKey && !field.isLocked ? { ...field, ...fromTriState(state) } : field,
          ),
        };
      }),
    );
  };

  const isDirty = (formKey: string): boolean => {
    const current = forms.find((f) => f.formKey === formKey);
    const saved = savedForms.find((f) => f.formKey === formKey);
    if (!current || !saved) return false;
    return current.fields.some((field) => {
      const savedField = saved.fields.find((f) => f.fieldKey === field.fieldKey);
      return !savedField || savedField.isVisible !== field.isVisible || savedField.isRequired !== field.isRequired;
    });
  };

  /** Whole-form PUT: every field of the form, locked entries echoed unchanged. */
  const saveForm = async (formKey: string) => {
    const form = forms.find((f) => f.formKey === formKey);
    if (!form) return;
    setSavingFormKey(formKey);
    try {
      const updated = await formFieldConfigService.update(
        form.fields.map((field) => ({
          formKey,
          fieldKey: field.fieldKey,
          isVisible: field.isVisible,
          isRequired: field.isRequired,
        })),
      );
      // The PUT returns the full grouped configuration for ALL forms. Merge
      // only the saved form into the editable state so in-progress edits on
      // the OTHER form cards survive; the response as a whole is the new
      // saved baseline (so those other edits still compare as dirty).
      setForms((prev) =>
        prev.map((f) => (f.formKey === formKey ? (updated.find((u) => u.formKey === f.formKey) ?? f) : f)),
      );
      setSavedForms(updated);
      invalidateFormFieldConfigCache();
      enqueueSnackbar(t('customer_forms_saved', 'Customer form settings saved'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('customer_forms_save_failed', 'Failed to save the customer form settings'), {
        variant: 'error',
      });
    } finally {
      setSavingFormKey(null);
    }
  };

  return { forms, loading, savingFormKey, setFieldState, isDirty, saveForm };
}
