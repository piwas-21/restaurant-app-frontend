'use client';

import React, { useState } from 'react';
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
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import QuickMenuVersionConfirmations from './QuickMenuVersionConfirmations';
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
  const suggestedName = () => t('suggested_menu_version_name', { productName: product.name });
  const [name, setName] = useState(suggestedName);
  const [price, setPrice] = useState(String(product.basePrice));
  const [variationId, setVariationId] = useState<string>('');
  const [sectionsConfirmed, setSectionsConfirmed] = useState(false);
  const [priceConfirmed, setPriceConfirmed] = useState(false);
  const [categoriesConfirmed, setCategoriesConfirmed] = useState(false);
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [channelsConfirmed, setChannelsConfirmed] = useState(false);
  const activeVariations = getActiveOfferVariations(product);
  const variation = activeVariations.find((candidate) => candidate.id === variationId);
  const requiresVariation = requiresOfferVariation(product);
  const nameError =
    name.trim().length === 0
      ? t('menu_bundle_name_required')
      : name.length > MENU_VERSION_NAME_MAX_LENGTH
        ? t('menu_bundle_name_too_long')
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
    setName(suggestedName());
    setPrice(String(product.basePrice));
    setVariationId('');
    setSectionsConfirmed(false);
    setPriceConfirmed(false);
    setCategoriesConfirmed(false);
    setScheduleConfirmed(false);
    setChannelsConfirmed(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = () => {
    if (!canSubmit) return;
    onCreateRequested(
      buildQuickMenuVersionPrefill(product, name.trim(), resolvedPrice, variation, t('menu_version_main_section')),
    );
    reset();
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
          <button type="button" className={modalStyles.submitButton} onClick={save} disabled={!canSubmit}>
            {t('continue_to_bundle_editor')}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        <p className={styles.summary}>
          {name} · {variation?.name ?? t('base_price')} ·{' '}
          {formatPlainCurrency(variation?.finalPrice ?? product.basePrice)}
        </p>
        <p className={styles.warning} role="status">
          {t('menu_version_prefill_warning')}
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
                  {candidate.name} · {formatPlainCurrency(candidate.finalPrice)}
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

        <QuickMenuVersionConfirmations
          sectionsConfirmed={sectionsConfirmed}
          priceConfirmed={priceConfirmed}
          categoriesConfirmed={categoriesConfirmed}
          scheduleConfirmed={scheduleConfirmed}
          channelsConfirmed={channelsConfirmed}
          onSectionsChange={setSectionsConfirmed}
          onPriceChange={setPriceConfirmed}
          onCategoriesChange={setCategoriesConfirmed}
          onScheduleChange={setScheduleConfirmed}
          onChannelsChange={setChannelsConfirmed}
        />

        <div className={styles.categoryList} aria-label={t('category')}>
          {product.categories.map((category) => (
            <span className={styles.category} key={category.categoryId}>
              {category.categoryName}
            </span>
          ))}
        </div>
      </div>
    </BaseModal>
  );
}
