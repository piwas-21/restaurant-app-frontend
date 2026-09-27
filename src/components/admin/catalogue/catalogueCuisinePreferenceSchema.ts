import { z } from 'zod';

export const MAX_CUISINE_PREFERENCES = 12;

export const cuisinePreferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const cuisinePreferencesSchema = z
  .array(cuisinePreferenceSchema)
  .max(MAX_CUISINE_PREFERENCES)
  .superRefine((cuisines, context) => {
    const seen = new Set<string>();
    cuisines.forEach((cuisine, index) => {
      if (seen.has(cuisine)) {
        context.addIssue({ code: 'custom', path: [index], message: 'duplicate' });
      }
      seen.add(cuisine);
    });
  });

export function normalizeCuisinePreference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
