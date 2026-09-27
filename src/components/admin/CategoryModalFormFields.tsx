import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import FormField from '@/components/design-system/FormField';
import type { CategoryFormInputValues } from './categoryFormSchema';
import CategoryHiddenFromAllTabField from './CategoryHiddenFromAllTabField';
import TranslationSuggestionsReview from './product-editor/translations/TranslationSuggestionsReview';

interface CategoryModalFormFieldsProps {
  readonly register: UseFormRegister<CategoryFormInputValues>;
  readonly errors: FieldErrors<CategoryFormInputValues>;
  readonly imageLabel: string;
  readonly review: ComponentProps<typeof TranslationSuggestionsReview>['review'];
  readonly onReviewToggle: ComponentProps<'details'>['onToggle'];
  readonly children: ReactNode;
}

export default function CategoryModalFormFields({
  register,
  errors,
  imageLabel,
  review,
  onReviewToggle,
  children,
}: CategoryModalFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      {errors.root?.message && <p className={styles.errorMessage}>{errors.root.message}</p>}
      <FormField label={t('category_name')} error={errors.name?.message} className={styles.formGroup}>
        <input {...register('name')} />
      </FormField>
      <FormField label={t('description')} error={errors.description?.message} className={styles.formGroup}>
        <textarea {...register('description')} />
      </FormField>
      {children}
      <details onToggle={onReviewToggle}>
        <summary>{t('translation_review_title')}</summary>
        <TranslationSuggestionsReview review={review} showSourceLocaleChoices={false} />
      </details>
      <FormField
        label={imageLabel}
        error={errors.imageFile?.message as string | undefined}
        className={styles.formGroup}
      >
        <input type="file" accept="image/*" {...register('imageFile')} />
      </FormField>
      <FormField label={t('is_active')} className={`${styles.formGroup} ${styles.checkboxGroup}`}>
        <input type="checkbox" {...register('isActive')} />
      </FormField>
      <CategoryHiddenFromAllTabField register={register} />
      <FormField label={t('display_order')} error={errors.displayOrder?.message} className={styles.formGroup}>
        <input type="number" {...register('displayOrder')} />
      </FormField>
    </>
  );
}
