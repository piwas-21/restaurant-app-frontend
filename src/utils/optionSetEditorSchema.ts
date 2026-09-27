import { z } from 'zod';
import { LANGUAGE_CODES, type LanguageCode } from '@/config/languageConfig';
import { OPTION_SET_KINDS } from '@/types/optionSet';

const optionSetEntrySchema = z.object({
  name: z.string().trim().min(1).max(200),
  globalIngredientId: z.string().optional(),
  productId: z.string().optional(),
  price: z.number().finite().min(0),
  maxQuantity: z.number().int().min(1),
  additionalPrice: z.number().finite().min(0),
});
const languageCodeSchema = z
  .string()
  .refine((value): value is LanguageCode => LANGUAGE_CODES.includes(value as LanguageCode));

export const optionSetEditorSchema = z
  .object({
    kind: z.enum(OPTION_SET_KINDS),
    name: z.string().trim().min(1).max(200),
    sourceLocale: languageCodeSchema,
    entries: z.array(optionSetEntrySchema).min(1),
  })
  .superRefine(({ kind, entries }, context) => {
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const reference = kind === 'ingredient' || kind === 'sauce' ? entry.globalIngredientId : entry.productId;
      if (!reference) {
        context.addIssue({ code: 'custom', path: ['entries', index], message: 'reference_required' });
      } else if (seen.has(reference)) {
        context.addIssue({ code: 'custom', path: ['entries', index], message: 'duplicate_reference' });
      }
      if (reference) seen.add(reference);
    });
  });
