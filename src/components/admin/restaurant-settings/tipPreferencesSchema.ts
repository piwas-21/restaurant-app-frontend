import { z } from 'zod';
import { parseCurrencyAmountMinor } from '@/lib/accountPaymentMoney';

export const MAX_TIP_PRESETS = 6;
const MAX_FIXED_MINOR = 100_000;
const MAX_PERCENTAGE = 100;

const fields = z.object({
  mode: z.enum(['percentage', 'fixed']),
  inputs: z.array(z.string()).min(1).max(MAX_TIP_PRESETS),
  currency: z.string().nullable(),
});
export type TipPreferencesForm = z.infer<typeof fields>;

export function parseTipPreferenceValues(form: TipPreferencesForm, locale: string) {
  return form.inputs
    .filter((input) => input.trim() !== '')
    .map((input) =>
      form.mode === 'fixed'
        ? parseCurrencyAmountMinor(input, form.currency ?? '', locale)
        : /^\d+$/.test(input)
          ? Number(input)
          : null,
    );
}

export function tipPreferencesSchema(locale: string) {
  return fields.superRefine((form, context) => {
    const values = parseTipPreferenceValues(form, locale);
    const maximum = form.mode === 'fixed' ? MAX_FIXED_MINOR : MAX_PERCENTAGE;
    if (
      values.length === 0 ||
      new Set(values).size !== values.length ||
      values.some((value) => value === null || !Number.isSafeInteger(value) || value <= 0 || value > maximum)
    ) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['inputs'], message: 'tip_preferences.values_hint' });
    }
    if (form.mode === 'fixed' && !/^[A-Z]{3}$/.test(form.currency ?? '')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['currency'],
        message: 'tip_preferences.currency_required',
      });
    }
  });
}
