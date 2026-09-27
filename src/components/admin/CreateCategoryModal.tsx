import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryFormSchema, type CategoryFormInputValues, type CategoryFormValues } from './categoryFormSchema';
import CategoryHiddenFromAllTabField from './CategoryHiddenFromAllTabField';
import CategoryTranslationsFields from './CategoryTranslationsFields';
import TranslationSuggestionsReview from './product-editor/translations/TranslationSuggestionsReview';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import BaseModal from '@/components/design-system/BaseModal';
import { useTranslation } from 'react-i18next';
import { createCategory } from '@/services/categoryService';
import { omitNewBlankCategoryTranslations } from '@/types/categoryTranslations';
import { useCategoryTranslationReview } from '@/hooks/admin/useCategoryTranslationReview';
import { uploadCreatedCategoryImage } from '@/utils/categoryImageFollowup';
import {
  applyCategoryFailure,
  reasonOr,
  type CategoryApiResponse,
  type SetCategoryError,
} from '@/lib/categoryFormErrors';

/** @see categoryFormSchema — one object for both modals, so they cannot drift (#642). */
export const createCategorySchema = categoryFormSchema.refine(
  (values) => values.sourceLocale !== null && values.sourceLocale !== undefined,
  {
    path: ['sourceLocale'],
    message: 'category_source_language_required',
  },
);

type CreateCategoryFormValues = CategoryFormValues;

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoryCreated: () => void;
  /** The category was written but a following step was not — see `categoryFormErrors`. */
  onPartialSuccess: (message: string) => void;
}

const CreateCategoryModal: React.FC<CreateCategoryModalProps> = ({
  isOpen,
  onClose,
  onCategoryCreated,
  onPartialSuccess,
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
    getValues,
    setValue,
  } = useForm<CategoryFormInputValues, unknown, CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      isActive: true,
      isHiddenFromAllTab: false,
      displayOrder: 0,
      translations: {},
      sourceLocale: null,
    },
  });
  const translationReview = useCategoryTranslationReview({ isOpen, control, getValues, setValue });

  // Adapter: react-hook-form's `setError` takes an object; the shared router takes a plain
  // (field, message) pair so it does not depend on react-hook-form.
  const setFormError: SetCategoryError = (field, message) => setError(field, { type: 'manual', message });

  const onSubmit = async (data: CreateCategoryFormValues) => {
    setIsSubmitting(true);
    setError('root', { message: '' }); // Clear previous errors

    try {
      if (!(await translationReview.review.submitDecisions())) return;
      const latest = getValues();
      // Step 1: Create the category without the image
      const categoryResponse = (await createCategory({
        name: latest.name,
        description: latest.description,
        isActive: latest.isActive,
        isHiddenFromAllTab: latest.isHiddenFromAllTab,
        displayOrder: latest.displayOrder,
        translations: omitNewBlankCategoryTranslations(latest.translations ?? {}),
        sourceLocale: latest.sourceLocale ?? null,
        translationMetadata: translationReview.review.buildMetadataPatch(),
      })) as CategoryApiResponse;

      if (!categoryResponse.success) {
        applyCategoryFailure(
          categoryResponse,
          t('category_create_failed', 'Failed to create the category'),
          setFormError,
        );
        setIsSubmitting(false);
        return;
      }

      const imageUploadResponse = await uploadCreatedCategoryImage(
        categoryResponse.data?.id,
        data.imageFile?.[0],
        (key, fallback) => t(key, fallback),
      );
      if (!imageUploadResponse.success) {
        // The category is already written, so this is a partial success reported on the page.
        onPartialSuccess(
          t('category_created_image_failed', 'Category created, but the image upload failed: {{reason}}', {
            reason: reasonOr(imageUploadResponse, t('category_image_failed_generic', 'the image was rejected')),
          }),
        );
        setIsSubmitting(false);
        onCategoryCreated();
        onClose();
        reset();
        return;
      }

      // If all steps are successful
      onCategoryCreated();
      onClose();
      reset();
    } catch (err) {
      // NOT just transport. The handlers do not throw, but `ValidationBehavior` and `[RequireAdmin]`
      // sit in front of them — a name over 100 chars, or an expired admin session, is a genuinely
      // refused category arriving as a non-2xx. See `categoryFormErrors`.
      applyCategoryFailure(err, t('category_create_failed', 'Failed to create the category'), setFormError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title={t('create_category')} size="lg" isPending={isSubmitting}>
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
          control={control}
          register={register}
          errors={errors}
          createMode
          onTranslationChange={translationReview.review.clearAcceptedSuggestionIds}
        />
        <details onToggle={translationReview.onToggle}>
          <summary>{t('translation_review_title')}</summary>
          <TranslationSuggestionsReview review={translationReview.review} showSourceLocaleChoices={false} />
        </details>
        <div className={styles.formGroup}>
          <label htmlFor="imageFile">{t('category_image')}</label>
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
        <div className={styles.buttonGroup}>
          <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
            {isSubmitting ? t('creating...') : t('create')}
          </button>
          <button type="button" onClick={onClose} className={styles.cancelButton} disabled={isSubmitting}>
            {t('cancel')}
          </button>
        </div>
      </form>
    </BaseModal>
  );
};

export default CreateCategoryModal;
