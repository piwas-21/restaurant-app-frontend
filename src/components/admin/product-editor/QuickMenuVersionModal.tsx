'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import { createMenuBundle } from '@/services/menuBundleService';
import { serverMessage } from '@/utils/apiFormErrors';
import { TENANT_CURRENCY } from '@/utils/currency';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import {
  buildQuickMenuVersionPayload,
  defaultMenuVersionName,
  extractCreatedId,
  MENU_VERSION_NAME_MAX_LENGTH,
} from '@/utils/quickMenuVersionPayload';
import { getActiveOfferVariations, requiresOfferVariation } from '@/utils/offerFamilyVariation';
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface QuickMenuVersionModalProps {
  readonly isOpen: boolean;
  readonly product: ProductDetails;
  readonly onClose: () => void;
  readonly onCreated: (menuId: string) => void;
}

export default function QuickMenuVersionModal({ isOpen, product, onClose, onCreated }: QuickMenuVersionModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(defaultMenuVersionName(product.name));
  const [price, setPrice] = useState(String(product.basePrice));
  const [variationId, setVariationId] = useState<string>('');
  const [sectionsConfirmed, setSectionsConfirmed] = useState(false);
  const [priceConfirmed, setPriceConfirmed] = useState(false);
  const [categoriesConfirmed, setCategoriesConfirmed] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [channelsConfirmed, setChannelsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeVariations = getActiveOfferVariations(product);
  const variation = activeVariations.find((candidate) => candidate.id === variationId);
  const requiresVariation = requiresOfferVariation(product);
  const nameError =
    name.trim().length === 0
      ? t('menu_bundle_name_required', 'Menu version name is required')
      : name.length > MENU_VERSION_NAME_MAX_LENGTH
        ? t('menu_bundle_name_too_long', 'Menu version name must be 100 characters or fewer')
        : undefined;
  const resolvedPrice = Number.parseFloat(price);
  const canSubmit =
    !nameError &&
    Number.isFinite(resolvedPrice) &&
    resolvedPrice > 0 &&
    sectionsConfirmed &&
    priceConfirmed &&
    categoriesConfirmed &&
    scheduleConfirmed &&
    channelsConfirmed &&
    (!requiresVariation || Boolean(variation?.id));

  const reset = () => {
    setName(defaultMenuVersionName(product.name));
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
      const response = await createMenuBundle(
        buildQuickMenuVersionPayload(product, name.trim(), resolvedPrice, variation),
      );
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
      title={t('create_menu_version', 'Create menu version')}
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
            {isSubmitting ? t('saving') : t('create_menu_version', 'Create menu version')}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <p className={styles.summary}>
          {name} · {variation?.name ?? t('base_price')} · {TENANT_CURRENCY}
        </p>

        <FormField label={t('menu_bundle_name')} error={nameError}>
          <input
            type="text"
            required
            maxLength={MENU_VERSION_NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        {requiresVariation && (
          <FormField
            label={t('product_variations')}
            error={
              activeVariations.length === 0
                ? t('no_active_variations', 'No active variations are available')
                : undefined
            }
          >
            <select value={variationId} onChange={(event) => setVariationId(event.target.value)}>
              <option value="">{t('select_product')}</option>
              {activeVariations.map((candidate) => (
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
          <CheckboxField label={t('menu_sections')} checked={sectionsConfirmed} onChange={setSectionsConfirmed} />
          <CheckboxField label={t('base_price')} checked={priceConfirmed} onChange={setPriceConfirmed} />
          <CheckboxField label={t('category')} checked={categoriesConfirmed} onChange={setCategoriesConfirmed} />
          <CheckboxField
            label={t('menu_availability_schedule')}
            checked={scheduleConfirmed}
            onChange={setScheduleConfirmed}
          />
          <CheckboxField label={t('product_order_types')} checked={channelsConfirmed} onChange={setChannelsConfirmed} />
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
