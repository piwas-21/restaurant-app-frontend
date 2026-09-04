import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import { GroupDiscountDto, DiscountType } from '@/types/userGroupTypes';
import { emptyAsNull, optionalMoney, requiredMoney } from './emptyAsNull';
import MoneyField from './MoneyField';

/**
 * #642. The three ways an admin can say "no minimum" / "no cap", and the one that used to store 0.
 *
 * `GroupDiscountDto.MinimumOrderAmount` / `.MaximumDiscountAmount` are `decimal?` on the entity, on
 * the DTO and in the 1:1 `UserGroupMapper` projection, so an unset cap is an explicit `null` on the
 * wire — and this modal seeds the form from that response VERBATIM. `.optional()` did not refuse
 * that null the way #638's string fields did; it did something quieter and worse, because
 * `z.coerce.number().optional()` short-circuits on `undefined` alone and `Number(null)` is 0.
 *
 * `.nullish()` closes the null. It does NOT close `''`, which is what a cleared number input
 * produces. Both are closed here — the table and the measurements are in `emptyAsNull.ts`.
 *
 * What 0 costs: `MembershipQrService:188` applies the cap on `HasValue` alone, with no `> 0` guard
 * (unlike `CustomerDiscountService:128`, which has one). A group discount whose maximum became 0
 * discounts nothing, silently, after a save that touched something else entirely.
 */
export const discountSchema = z.object({
  name: z.string().min(1, { message: 'Discount name is required' }),
  type: z.nativeEnum(DiscountType),
  // A blank box is a refusal here, not a 0 — see `requiredMoney`. Clearing this used to save a
  // discount of 0, which is the same "discounts nothing" outcome as a cap of 0.
  value: requiredMoney('Value must be positive'),
  minimumOrderAmount: optionalMoney(),
  maximumDiscountAmount: optionalMoney(),
  isActive: z.boolean(),
});

/**
 * TWO types, because `requiredMoney`/`optionalMoney` preprocess: the form HOLDS what the inputs
 * produce (a string from a number box, `null` from `emptyAsNull`), and the submit handler RECEIVES
 * what the schema produced. `z.infer` is the output alone, so using it for both is what made
 * `useForm` and `zodResolver` disagree once a preprocess existed.
 */
type DiscountFormInput = z.input<typeof discountSchema>;
type DiscountFormValues = z.output<typeof discountSchema>;

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DiscountFormValues) => Promise<void>;
  initialData?: GroupDiscountDto | null;
  isSubmitting: boolean;
}

const DiscountModal: React.FC<DiscountModalProps> = ({ isOpen, onClose, onSubmit, initialData, isSubmitting }) => {
  const { t } = useTranslation();
  const isEditMode = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DiscountFormInput, unknown, DiscountFormValues>({
    resolver: zodResolver(discountSchema),
    defaultValues: {
      type: DiscountType.Percentage,
      isActive: true,
      value: 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          name: initialData.name,
          type: initialData.type,
          value: initialData.value,
          minimumOrderAmount: initialData.minimumOrderAmount,
          maximumDiscountAmount: initialData.maximumDiscountAmount,
          isActive: initialData.isActive,
        });
      } else {
        reset({
          name: '',
          type: DiscountType.Percentage,
          value: 0,
          // `null`, not 0: a NEW discount has no minimum and no cap, and 0 is a different
          // statement — `MembershipQrService` reads a cap of 0 as "discount nothing". The create
          // path seeded 0 for both, so every discount created through this modal shipped with a
          // cap that silently zeroed it.
          minimumOrderAmount: null,
          maximumDiscountAmount: null,
          isActive: true,
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const handleFormSubmit = async (data: DiscountFormValues) => {
    await onSubmit(data);
    if (!isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>{isEditMode ? t('edit_discount') : t('create_discount')}</h2>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className={styles.formGroup}>
            <label htmlFor="name">{t('discount_name')} *</label>
            <input id="name" {...register('name')} />
            {errors.name && <p className={styles.errorMessage}>{errors.name.message}</p>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="type">{t('discount_type')}</label>
            <select id="type" {...register('type')}>
              <option value={DiscountType.Percentage}>{t('percentage')}</option>
              <option value={DiscountType.FixedAmount}>{t('fixed_amount')}</option>
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="value">{t('discount_value')} *</label>
            <input type="number" step="0.01" id="value" {...register('value')} />
            {errors.value && <p className={styles.errorMessage}>{errors.value.message}</p>}
          </div>

          <div className={styles.row}>
            <MoneyField
              id="minimumOrderAmount"
              label={t('min_order_amount')}
              registration={register('minimumOrderAmount', emptyAsNull)}
              error={errors.minimumOrderAmount?.message}
            />
            <MoneyField
              id="maximumDiscountAmount"
              label={t('max_discount_amount')}
              registration={register('maximumDiscountAmount', emptyAsNull)}
              error={errors.maximumDiscountAmount?.message}
            />
          </div>

          <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
            <label htmlFor="isActive">
              <input type="checkbox" id="isActive" {...register('isActive')} />
              {t('active_status')}
            </label>
          </div>

          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? t('saving...') : isEditMode ? t('save_changes') : t('create')}
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

export default DiscountModal;
