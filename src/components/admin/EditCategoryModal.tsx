import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { categoryFormSchema, type CategoryFormValues } from './categoryFormSchema';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import { useTranslation } from 'react-i18next';
import CategoryOrderTypesSummary from '@/components/admin/CategoryOrderTypesSummary';
import { type SetCategoryError } from '@/lib/categoryFormErrors';
import { useEditCategorySave } from '@/hooks/admin/useEditCategorySave';

/** @see categoryFormSchema — one object for both modals, so they cannot drift (#642). */
export const editCategorySchema = categoryFormSchema;

type EditCategoryFormValues = CategoryFormValues;

interface Category {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  displayOrder: number;
  /** Raw OrderChannels mask; `null` = every order type. Shown read-only, echoed back on save. */
  availableOrderTypes?: number | null;
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
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<EditCategoryFormValues>({
    resolver: zodResolver(editCategorySchema),
  });

  // See `CreateCategoryModal` — react-hook-form's `setError` shape, adapted to the shared router.
  const setFormError: SetCategoryError = (field, message) => setError(field, { type: 'manual', message });
  // The three-request save (update -> reorder -> image) and its partial-success accounting.
  const { save, isSubmitting } = useEditCategorySave(category, setFormError, onPartialSuccess);

  useEffect(() => {
    if (category) {
      reset({
        name: category.name,
        description: category.description || '',
        isActive: category.isActive,
        displayOrder: category.displayOrder,
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: EditCategoryFormValues) => {
    setError('root', { message: '' });
    const saved = await save(data, data.imageFile?.[0]);
    if (!saved) return;
    onCategoryUpdated();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>{t('edit_category')}</h2>
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
            <label htmlFor="imageFile">{t('category_image_edit')}</label>
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
      </div>
    </div>
  );
};

export default EditCategoryModal;
