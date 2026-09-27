import {
  cuisinePreferencesSchema,
  cuisinePreferenceSchema,
  MAX_CUISINE_PREFERENCES,
  normalizeCuisinePreference,
} from './catalogueCuisinePreferenceSchema';

describe('catalogue cuisine preference schema', () => {
  it('normalizes a name and validates the stored slug', () => {
    const slug = normalizeCuisinePreference('  Spicy food! ');

    expect(slug).toBe('spicy-food');
    expect(cuisinePreferenceSchema.safeParse(slug).success).toBe(true);
  });

  it('rejects empty, malformed, duplicate, and over-limit preferences', () => {
    expect(cuisinePreferenceSchema.safeParse('').success).toBe(false);
    expect(cuisinePreferenceSchema.safeParse('---').success).toBe(false);
    expect(cuisinePreferencesSchema.safeParse(['thai', 'thai']).success).toBe(false);
    expect(
      cuisinePreferencesSchema.safeParse(Array.from({ length: MAX_CUISINE_PREFERENCES + 1 }, (_, i) => `cuisine-${i}`))
        .success,
    ).toBe(false);
  });
});
