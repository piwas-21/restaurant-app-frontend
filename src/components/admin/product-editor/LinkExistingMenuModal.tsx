'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { linkMenuOffer } from '@/services/menuOfferFamilyService';
import { getActiveOfferVariations, requiresOfferVariation } from '@/utils/offerFamilyVariation';
import { serverMessage } from '@/utils/apiFormErrors';
import { formatPlainCurrency } from '@/utils/currency';
import type { ProductDetails, Variation } from '@/app/admin/menu-management/interfaces';
import { useLinkExistingMenuLoader } from '@/hooks/admin/useLinkExistingMenuLoader';
import LinkExistingMenuPreview from './LinkExistingMenuPreview';
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface LinkExistingMenuModalProps {
  readonly isOpen: boolean;
  readonly product: ProductDetails;
  readonly onClose: () => void;
  readonly onLinked: () => void;
}

/** Safe migration surface for an existing bundle. It previews the chosen menu before the
 * relationship-only endpoint is called; no menu sections are sent or rewritten. */
export default function LinkExistingMenuModal({ isOpen, product, onClose, onLinked }: LinkExistingMenuModalProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [selectedId, setSelectedId] = useState('');
  const [variationId, setVariationId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const parentEligible = !product.isComponent && !product.menuDefinition?.parentOfferProductId;
  const { bundles, parentNames, isLoading, loadError } = useLinkExistingMenuLoader({
    isOpen,
    productId: product.id,
    parentEligible,
  });
  const selected = bundles.find((bundle) => bundle.id === selectedId);
  const selectedLinkable = Boolean(parentEligible && selected && !selected.isComponent);
  const activeVariations = getActiveOfferVariations(product);
  const variation = activeVariations.find((candidate: Variation) => candidate.id === variationId);
  const variationRequired = requiresOfferVariation(product);
  const parentCategories = new Set(
    (product.categories ?? []).map((category) => category.categoryName.trim().toLowerCase()),
  );
  const selectedCategories = selected?.categoryNames;
  const categoryMismatch =
    selectedCategories !== undefined &&
    selectedCategories.every((category) => !parentCategories.has(category.trim().toLowerCase()));
  const currentParentId = selected?.parentOfferProductId ?? null;
  const currentParentName = currentParentId ? (parentNames[currentParentId] ?? currentParentId) : null;
  const needsReassignment = Boolean(currentParentId && currentParentId !== product.id);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId('');
    setVariationId('');
    setError(null);
    setIsReassignConfirmOpen(false);
  }, [isOpen, product.id]);

  const linkSelected = async () => {
    if (!selectedId || !selectedLinkable || (variationRequired && !variation)) return;
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await linkMenuOffer(selectedId, {
        parentOfferProductId: product.id,
        parentOfferVariationId: variation?.id ?? null,
      });
      if (!mountedRef.current) return;
      if (!response.success) {
        setError(serverMessage(response) ?? tRef.current('error_loading_menu_bundles'));
        return;
      }
      onLinked();
      onClose();
    } catch (error_) {
      if (mountedRef.current) setError(serverMessage(error_) ?? tRef.current('error_loading_menu_bundles'));
    } finally {
      if (mountedRef.current) setIsSaving(false);
    }
  };

  const save = () => {
    if (!selectedId || !selectedLinkable || (variationRequired && !variation)) return;
    if (needsReassignment) {
      setIsReassignConfirmOpen(true);
      return;
    }
    void linkSelected();
  };

  const visibleError =
    error ?? (loadError ? (serverMessage(loadError) ?? tRef.current('error_loading_menu_bundles')) : null);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('link_existing_menu_version', 'Link existing menu version')}
      size="md"
      isPending={isSaving}
      footer={
        <div className={styles.footer}>
          <button type="button" className={modalStyles.cancelButton} onClick={onClose} disabled={isSaving}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={modalStyles.submitButton}
            onClick={save}
            disabled={!selectedLinkable || (variationRequired && !variation) || isSaving}
          >
            {isSaving ? t('saving') : t('link_menu_version', 'Link menu version')}
          </button>
        </div>
      }
    >
      <div className={styles.form}>
        {isLoading && <p>{t('loading_menu_bundles')}</p>}
        {!isLoading && bundles.length === 0 && <p>{t('no_menu_bundles_found')}</p>}
        {!isLoading && bundles.length > 0 && (
          <FormField label={t('menu_bundles')}>
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">{t('select_product')}</option>
              {bundles.map((bundle) => (
                <option key={bundle.id} value={bundle.id}>
                  {bundle.name} · {formatPlainCurrency(bundle.basePrice)}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {variationRequired && (
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
                  {candidate.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {selected && (
          <LinkExistingMenuPreview
            productName={product.name}
            selected={selected}
            currentParentName={currentParentName}
            selectedCategories={selectedCategories}
            categoryMismatch={categoryMismatch}
          />
        )}
        {visibleError && (
          <p role="alert" className={styles.error}>
            {visibleError}
          </p>
        )}
      </div>
      <ConfirmationModal
        isOpen={isReassignConfirmOpen}
        onClose={() => setIsReassignConfirmOpen(false)}
        onConfirm={() => {
          setIsReassignConfirmOpen(false);
          void linkSelected();
        }}
        message={t('reassign_menu_confirmation', { parentName: currentParentName ?? '' })}
      />
    </BaseModal>
  );
}
