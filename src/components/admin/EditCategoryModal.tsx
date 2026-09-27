import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryFormSchema, type CategoryFormInputValues, type CategoryFormValues } from './categoryFormSchema';
import CategoryHiddenFromAllTabField from './CategoryHiddenFromAllTabField';
import CategoryTranslationsFields from './CategoryTranslationsFields';
import TranslationSuggestionsReview from './product-editor/translations/TranslationSuggestionsReview';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import BaseModal from '@/components/design-system/BaseModal';
import { useTranslation } from 'react-i18next';
import CategoryOrderTypesSummary from '@/components/admin/CategoryOrderTypesSummary';
import { type SetCategoryError } from '@/lib/categoryFormErrors';
import { useEditCategorySave } from '@/hooks/admin/useEditCategorySave';
import type { CategoryTranslations } from '@/types/categoryTranslations';
import type { LanguageCode } from '@/config/languageConfig';
import type { TranslationMetadata } from '@/types/translationMetadata';
import { useCategoryTranslationReview } from '@/hooks/admin/useCategoryTranslationReview';

/** @see categoryFormSchema — one object for both modals, so they cannot drift (#642). */
export const editCategorySchema = categoryFormSchema;

type EditCategoryFormValues = CategoryFormValues;

interface Category {
  id: string;
  name: string;
  description?: string | null;
  translations?: CategoryTranslations;
  sourceLocale?: LanguageCode | null;
  isActive: boolean;
  isHiddenFromAllTab?: boolean;
  displayOrder: number;
  /** Raw OrderChannels mask; `null` = every order type. Shown read-only, echoed back on save. */
  availableOrderTypes?: number | null;
  translationMetadata?: TranslationMetadata;
}

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryUpdated: () => void;
  category: Category | null;
  /** See `CreateCategoryModal` — required for the same reason: this modal closes on a partial save. */
  onPartialSuccess: (message: string) => void;
}

const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryUpdated,
  category,
  onPartialSuccess,
}) => {
  const { t } = useTranslation();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
    getValues,
    setValue,
  } = useForm<CategoryFormInputValues, unknown, EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
  });

  // See `CreateCategoryModal` — react-hook-form's `setError` shape, adapted to the shared router.
  const setFormError: SetCategoryError = (field, message) => setError(field, { type: 'manual', message });
  // The three-request save (update -> reorder -> image) and its partial-success accounting.
  const { save, isSubmitting } = useEditCategorySave(category, setFormError, onPartialSuccess);
  const translationReview = useCategoryTranslationReview({
    isOpen,
    categoryId: category?.id,
    expectedContentVersion: category?.translationMetadata?.expectedContentVersion,
    control,
    getValues,
    setValue,
  });

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        translations: category.translations,
        sourceLocale: category.sourceLocale,
        isActive: category.isActive,
        isHiddenFromAllTab: category.isHiddenFromAllTab ?? false,
        displayOrder: category.displayOrder,
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: EditCategoryFormValues) => {
    setError('root', { message: '' });
    if (!(await translationReview.review.submitDecisions())) return;
    const saved = await save(
      getValues() as EditCategoryFormValues,
      data.imageFile?.[0],
      translationReview.review.buildMetadataPatch(),
    );
    if (!saved) return;
    onCategoryUpdated();
    onClose();
  };

  if (!category) return null;

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('edit_category')} size="lg" isPending={isSubmitting}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {errors.root && <p className={styles.errorMessage}>{errors.root.message}</p>}
        <div className={styles.formGroup}>
          <label htmlFor="name">{t('category_name')}</label>
          <input id="name" {...register('name')} />
          {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="description">{t('description')}</label>
          <textarea id="description" {...register('description')} />
          {errors.description && <p className={styles.errorMessage}>{errors.description.message}</p>}
        </div>
        <CategoryTranslationsFields
          key={category?.id ?? 'new'}
          control={control}
          register={register}
          errors={errors}
          initialTranslations={category.translations ?? {}}
          initialSourceLocale={category.sourceLocale}
          onTranslationChange={translationReview.review.clearAcceptedSuggestionIds}
        />
        <details onToggle={translationReview.onToggle}>
          <summary>{t('translation_review_title')}</summary>
          <TranslationSuggestionsReview review={translationReview.review} showSourceLocaleChoices={false} />
        </details>
        <div className={styles.formGroup}>
          <label htmlFor="imageFile">{t('category_image_edit')}</label>
          <input id="imageFile" type="file" accept="image/*" {...register('imageFile')} />
          {errors.imageFile && <p className={styles.errorMessage}>{errors.imageFile.message as string}</p>}
        </div>
        <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
          <label htmlFor="isActive">
            <input type="checkbox" id="isActive" {...register('isActive')} />
            {t('is_active')}
          </label>
        </div>
        <CategoryHiddenFromAllTabField register={register} />
        <div className={styles.formGroup}>
          <label htmlFor="displayOrder">{t('display_order')}</label>
          <input id="displayOrder" type="number" {...register('displayOrder')} />
          {errors.displayOrder && <p className={styles.errorMessage}>{errors.displayOrder.message}</p>}
        </div>
        <CategoryOrderTypesSummary mask={category?.availableOrderTypes} className={styles.formGroup} />
        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? t('saving...') : t('save_changes')}
          </button>
          <button type="button" onClick={onClose} className={styles.cancelButton} disabled={isSubmitting}>
            {t('cancel')}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default EditCategoryModal;
