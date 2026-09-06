import { useTranslation } from 'react-i18next';
import type { UseFormRegister } from 'react-hook-form';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import type { CategoryFormValues } from './categoryFormSchema';

/**
 * The per-category "hide from the guest All tab" checkbox (partner feedback, 2026-09-06). Shared by
 * the create + edit category modals so the field cannot drift between them — and so the PR's
 * new-code duplication stays honest instead of pasting the same four lines twice (Sonar gate).
 * Renders like the sibling isActive checkbox: a formGroup with a block label over the input.
 */
export default function CategoryHiddenFromAllTabField({ register }: { register: UseFormRegister<CategoryFormValues> }) {
  const { t } = useTranslation();
  return (
    <div className={styles.formGroup}>
      <label htmlFor="isHiddenFromAllTab">{t('is_hidden_from_all_tab')}</label>
      <input type="checkbox" id="isHiddenFromAllTab" {...register('isHiddenFromAllTab')} />
    </div>
  );
}
