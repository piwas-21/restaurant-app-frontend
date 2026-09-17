'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { createMenuBundle } from '@/services/menuBundleService';
import { serverMessage } from '@/utils/apiFormErrors';
import { TENANT_CURRENCY } from '@/utils/currency';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import { buildQuickMenuVersionPayload, extractCreatedId } from '@/utils/quickMenuVersionPayload';
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface QuickMenuVersionModalProps {
  readonly isOpen: boolean;
  readonly product: ProductDetails;
  readonly onClose: () => void;
  readonly onCreated: (menuId: string) => void;
}

/**
 * A deliberately explicit quick builder. It reuses the source product and every inherited decision
 * has a confirmation so a fast click cannot create an empty menu or silently publish wrong settings. */
export default function QuickMenuVersionModal({ isOpen, product, onClose, onCreated }: QuickMenuVersionModalProps) {
  const { t } = useTranslation();
  const [price, setPrice] = useState(String(product.basePrice));
  const [variationId, setVariationId] = useState<string>('');
  const [sectionsConfirmed, setSectionsConfirmed] = useState(false);
  const [priceConfirmed, setPriceConfirmed] = useState(false);
  const [categoriesConfirmed, setCategoriesConfirmed] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [channelsConfirmed, setChannelsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const variation = useMemo(
    () => product.variations.find((candidate) => candidate.id === variationId),
    [product.variations, variationId],
  );
  const resolvedPrice = Number.parseFloat(price);
  const canSubmit =
    Number.isFinite(resolvedPrice) &&
    resolvedPrice > 0 &&
    sectionsConfirmed &&
    priceConfirmed &&
    categoriesConfirmed &&
    scheduleConfirmed &&
    channelsConfirmed;

  const reset = () => {
    setPrice(String(product.basePrice));
    setVariationId('');
    setSectionsConfirmed(false);
    setPriceConfirmed(false);
    setCategoriesConfirmed(false);
    setScheduleConfirmed(false);
    setChannelsConfirmed(false);
    setError(null);
  };

  const close = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  const save = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await createMenuBundle(buildQuickMenuVersionPayload(product, resolvedPrice, variation));
      const id = extractCreatedId(response);
      if (!id) {
        setError(serverMessage(response) ?? t('error_loading_menu_bundles'));
        return;
      }
      reset();
      onCreated(id);
    } catch (caught) {
      setError(serverMessage(caught) ?? t('error_loading_menu_bundles'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={close}
      title={t('create_menu_bundle')}
      size="md"
      isPending={isSubmitting}
      footer={
        <div className={styles.footer}>
          <button type="button" className={modalStyles.cancelButton} onClick={close} disabled={isSubmitting}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={modalStyles.submitButton}
            onClick={save}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? t('saving') : t('create_menu_bundle')}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <p className={styles.summary}>
          {product.name} · {variation?.name ?? t('base_price')} · {TENANT_CURRENCY}
        </p>

        {product.variations.length > 0 && (
          <FormField label={t('product_variations')}>
            <select value={variationId} onChange={(event) => setVariationId(event.target.value)}>
              <option value="">{t('select_product')}</option>
              {product.variations
                .filter((candidate) => Boolean(candidate.id))
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name} · {candidate.finalPrice}
                  </option>
                ))}
            </select>
          </FormField>
        )}

        <FormField label={`${t('base_price')} (${TENANT_CURRENCY})`}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </FormField>

        <div className={styles.confirmations}>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={sectionsConfirmed}
              onChange={(event) => setSectionsConfirmed(event.target.checked)}
            />
            <span>{t('menu_sections')}</span>
          </label>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={priceConfirmed}
              onChange={(event) => setPriceConfirmed(event.target.checked)}
            />
            <span>{t('base_price')}</span>
          </label>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={categoriesConfirmed}
              onChange={(event) => setCategoriesConfirmed(event.target.checked)}
            />
            <span>{t('category')}</span>
          </label>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={scheduleConfirmed}
              onChange={(event) => setScheduleConfirmed(event.target.checked)}
            />
            <span>{t('menu_availability_schedule')}</span>
          </label>
          <label className={styles.confirmation}>
            <input
              type="checkbox"
              checked={channelsConfirmed}
              onChange={(event) => setChannelsConfirmed(event.target.checked)}
            />
            <span>{t('product_order_types')}</span>
          </label>
        </div>

        <div className={styles.categoryList} aria-label={t('category')}>
          {product.categories.map((category) => (
            <span className={styles.category} key={category.categoryId}>
              {category.categoryName}
            </span>
          ))}
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
