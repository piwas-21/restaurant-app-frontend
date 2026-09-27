import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryFormSchema, type CategoryFormInputValues, type CategoryFormValues } from './categoryFormSchema';
import CategoryTranslationsFields from './CategoryTranslationsFields';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import BaseModal from '@/components/design-system/BaseModal';
import CategoryModalFormFields from './CategoryModalFormFields';
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
        <CategoryModalFormFields
          register={register}
          errors={errors}
          imageLabel={t('category_image_edit')}
          review={translationReview.review}
          onReviewToggle={translationReview.onToggle}
        >
          <CategoryTranslationsFields
            key={category?.id ?? 'new'}
            control={control}
            register={register}
            errors={errors}
            initialTranslations={category.translations ?? {}}
            initialSourceLocale={category.sourceLocale}
            onTranslationChange={translationReview.review.clearAcceptedSuggestionIds}
          />
        </CategoryModalFormFields>
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
