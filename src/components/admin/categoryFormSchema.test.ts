import { categoryFormSchema } from './categoryFormSchema';
import { createCategorySchema } from './CreateCategoryModal';
import { omitNewBlankCategoryTranslations } from '@/types/categoryTranslations';

const legacyCategoryForm = {
  name: 'Grills',
  description: null,
  translations: {},
  sourceLocale: null,
  isActive: true,
  isHiddenFromAllTab: false,
  displayOrder: 0,
};

describe('category form locale fields', () => {
  it('keeps unknown source locale valid for legacy edits but requires it on create', () => {
    expect(categoryFormSchema.safeParse(legacyCategoryForm).success).toBe(true);
    const createResult = createCategorySchema.safeParse(legacyCategoryForm);
    expect(createResult.success).toBe(false);
    if (!createResult.success) {
      expect(createResult.error.issues[0].message).toBe('category_source_language_required');
    }
    expect(createCategorySchema.safeParse({ ...legacyCategoryForm, sourceLocale: undefined }).success).toBe(false);
    expect(createCategorySchema.safeParse({ ...legacyCategoryForm, sourceLocale: 'fr' }).success).toBe(true);
  });

  it('removes only a newly selected blank locale and preserves existing map entries', () => {
    expect(
      omitNewBlankCategoryTranslations(
        { fr: { name: 'Plats' }, en: { name: '', description: '' } },
        { fr: { name: 'Plats' } },
      ),
    ).toEqual({ fr: { name: 'Plats' } });
  });
});
