import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryFormSchema, type CategoryFormValues } from './categoryFormSchema';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import { useTranslation } from 'react-i18next';
import { createCategory, uploadCategoryImage } from '@/services/categoryService';
import {
  applyCategoryFailure,
  reasonOr,
  type CategoryApiResponse,
  type SetCategoryError,
} from '@/lib/categoryFormErrors';

/** @see categoryFormSchema — one object for both modals, so they cannot drift (#642). */
export const createCategorySchema = categoryFormSchema;

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
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<CreateCategoryFormValues>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      isActive: true,
      displayOrder: 0,
    },
  });

  // Adapter: react-hook-form's `setError` takes an object; the shared router takes a plain
  // (field, message) pair so it does not depend on react-hook-form.
  const setFormError: SetCategoryError = (field, message) => setError(field, { type: 'manual', message });

  const onSubmit = async (data: CreateCategoryFormValues) => {
    setIsSubmitting(true);
    setError('root', { message: '' }); // Clear previous errors

    try {
      // Step 1: Create the category without the image
      const categoryResponse = (await createCategory({
        name: data.name,
        description: data.description,
        isActive: data.isActive,
        displayOrder: data.displayOrder,
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

      // Step 2: If an image is provided, upload it
      const imageFile = data.imageFile?.[0];
      if (imageFile) {
        // `data` is optional on the response type, and a create that somehow reports success
        // without one leaves nothing to attach the image to. Treat that as a failed upload rather
        // than skipping it: skipping would close the modal as though the image had been saved,
        // which is the silent failure this whole sweep is about. (The previous code read
        // `data.id` unguarded, so this case threw into the catch — reported, but as a generic.)
        const newCategoryId = categoryResponse.data?.id;
        const imageUploadResponse: CategoryApiResponse = newCategoryId
          ? ((await uploadCategoryImage(newCategoryId, imageFile)) as CategoryApiResponse)
          : // A distinct reason, because no upload was attempted and the server rejected nothing.
            // Reusing "the image was rejected" here would put a server decision in the admin's
            // mouth that never happened.
            { success: false, errors: [t('category_image_no_id', 'the new category could not be identified')] };

        if (!imageUploadResponse.success) {
          // The category is already written, so this is a partial success and NOT a `setError`
          // — that slot unmounts before it paints. See the partial-success note in
          // `categoryFormErrors`; the reason itself comes from `errors[0]`, see `reasonOr`.
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>{t('create_category')}</h2>
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
          <div className={styles.formGroup}>
            <label htmlFor="imageFile">{t('category_image')}</label>
            <input id="imageFile" type="file" accept="image/*" {...register('imageFile')} />
            {errors.imageFile && <p className={styles.errorMessage}>{errors.imageFile.message as string}</p>}
          </div>
          <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
            <label htmlFor="isActive">{t('is_active')}</label>
            <input type="checkbox" id="isActive" {...register('isActive')} />
          </div>
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
      </div>
    </div>
  );
};

export default CreateCategoryModal;
