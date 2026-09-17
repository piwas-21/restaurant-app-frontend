'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { formatPlainCurrency, TENANT_CURRENCY } from '@/utils/currency';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import {
  buildQuickMenuVersionPrefill,
  MENU_VERSION_NAME_MAX_LENGTH,
  type MenuVersionPrefill,
} from '@/utils/quickMenuVersionPayload';
import { getActiveOfferVariations, requiresOfferVariation } from '@/utils/offerFamilyVariation';
import {
  buildQuickMenuVersionValidationMessages,
  quickMenuVersionSchema,
  type QuickMenuVersionFormInput,
  type QuickMenuVersionFormValues,
} from '@/schemas/quickMenuVersion.schema';
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import QuickMenuVersionConfirmations from './QuickMenuVersionConfirmations';

const FORM_ID = 'quick-menu-version-form';
interface QuickMenuVersionModalProps {
  readonly isOpen: boolean;
  readonly product: ProductDetails;
  readonly onClose: () => void;
  readonly onCreateRequested: (prefill: MenuVersionPrefill) => void;
}
export default function QuickMenuVersionModal({
  isOpen,
  product,
  onClose,
  onCreateRequested,
}: QuickMenuVersionModalProps) {
  const { t } = useTranslation();
  const activeVariations = useMemo(() => getActiveOfferVariations(product), [product]);
  const activeVariationIds = useMemo(
    () => activeVariations.map((variation) => variation.id).filter((id): id is string => Boolean(id)),
    [activeVariations],
  );
  const requiresVariation = requiresOfferVariation(product);
  const defaultValues = useMemo<QuickMenuVersionFormInput>(
    () => ({
      name: t('suggested_menu_version_name', { productName: product.name }),
      price: String(product.basePrice),
      variationId: '',
      sectionsConfirmed: false,
      priceConfirmed: false,
      categoriesConfirmed: false,
      scheduleConfirmed: false,
      channelsConfirmed: false,
    }),
    [product.basePrice, product.name, t],
  );
  const validationMessages = useMemo(
    () => buildQuickMenuVersionValidationMessages(t, activeVariations.length),
    [activeVariations.length, t],
  );
  const schema = useMemo(
    () =>
      quickMenuVersionSchema({
        activeVariationIds,
        requiresVariation,
        messages: validationMessages,
      }),
    [activeVariationIds, requiresVariation, validationMessages],
  );
  const {
    register,
    control,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuickMenuVersionFormInput, unknown, QuickMenuVersionFormValues>({
    resolver: zodResolver(schema, undefined, { mode: 'sync' }),
    mode: 'onChange',
    defaultValues,
  });
  const watchedName = watch('name');
  const watchedPrice = watch('price');
  const watchedVariationId = watch('variationId');
  const watchedValues = watch();
  const selectedVariation = activeVariations.find((candidate) => candidate.id === watchedVariationId);
  const summaryPrice = Number.isFinite(Number(watchedPrice)) ? Number(watchedPrice) : product.basePrice;
  const validationResult = schema.safeParse(watchedValues);
  const schemaError = (fieldName: string): string | undefined => {
    if (validationResult.success) return undefined;
    return validationResult.error.issues.find((issue) => issue.path[0] === fieldName)?.message;
  };
  const confirmationErrors = {
    sectionsConfirmed: schemaError('sectionsConfirmed'),
    priceConfirmed: schemaError('priceConfirmed'),
    categoriesConfirmed: schemaError('categoriesConfirmed'),
    scheduleConfirmed: schemaError('scheduleConfirmed'),
    channelsConfirmed: schemaError('channelsConfirmed'),
  };
  const resetKey = `${product.id}:${product.name}:${product.basePrice}`;
  const resetKeyRef = useRef('');
  useEffect(() => {
    if (!isOpen) {
      resetKeyRef.current = '';
      return;
    }
    if (resetKeyRef.current === resetKey) return;
    reset(defaultValues);
    resetKeyRef.current = resetKey;
  }, [defaultValues, isOpen, reset, resetKey]);
  const close = () => {
    reset(defaultValues);
    onClose();
  };
  const save = (data: QuickMenuVersionFormValues) => {
    const variation = activeVariations.find((candidate) => candidate.id === data.variationId);
    onCreateRequested(
      buildQuickMenuVersionPrefill(product, data.name, data.price, variation, t('menu_version_main_section')),
    );
  };
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      title={t('create_menu_version', 'Create menu version')}
      size="md"
      footer={
        <div className={styles.footer}>
          <button type="button" className={modalStyles.cancelButton} onClick={close}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            form={FORM_ID}
            className={modalStyles.submitButton}
            disabled={!validationResult.success}
            onClick={(event) => {
              event.preventDefault();
              void handleSubmit(save)();
            }}
          >
            {t('continue_to_bundle_editor')}
          </button>
        </div>
      }
    >
      <form id={FORM_ID} className={styles.form} onSubmit={handleSubmit(save)} noValidate>
        <p className={styles.summary}>
          {watchedName} · {selectedVariation?.name ?? t('base_price')} · {formatPlainCurrency(summaryPrice)}
        </p>
        <p className={styles.warning} role="status">
          {t('menu_version_prefill_warning')}
        </p>
        <FormField label={t('menu_bundle_name')} error={errors.name?.message ?? schemaError('name')}>
          <input type="text" maxLength={MENU_VERSION_NAME_MAX_LENGTH} {...register('name')} />
        </FormField>

        {requiresVariation && (
          <FormField label={t('product_variations')} error={errors.variationId?.message ?? schemaError('variationId')}>
            <select {...register('variationId')}>
              <option value="">{t('select_product')}</option>
              {activeVariations.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {formatPlainCurrency(candidate.finalPrice)}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField
          label={`${t('base_price')} (${TENANT_CURRENCY})`}
          error={errors.price?.message ?? schemaError('price')}
        >
          <input type="number" min="0.01" step="0.01" {...register('price')} />
        </FormField>
        <QuickMenuVersionConfirmations control={control} schemaErrors={confirmationErrors} />

        <div className={styles.categoryList} aria-label={t('category')}>
          {product.categories.map((category) => (
            <span className={styles.category} key={category.categoryId}>
              {category.categoryName}
            </span>
          ))}
        </div>
      </form>
    </BaseModal>
  );
}
