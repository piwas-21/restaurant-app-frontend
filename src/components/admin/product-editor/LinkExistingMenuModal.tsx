'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { getAllMenuBundles } from '@/services/menuService';
import { linkMenuOffer } from '@/services/menuOfferFamilyService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { getActiveOfferVariations, requiresOfferVariation } from '@/utils/offerFamilyVariation';
import { serverMessage } from '@/utils/apiFormErrors';
import type { ProductDetails, Product, Variation } from '@/app/admin/menu-management/interfaces';
import styles from './QuickMenuVersionModal.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface LinkExistingMenuModalProps {
  readonly isOpen: boolean;
  readonly product: ProductDetails;
  readonly onClose: () => void;
  readonly onLinked: () => void;
}

const parentId = (menu: Product): string | null => menu.parentOfferProductId ?? null;

/** Safe migration surface for an existing bundle. It previews the chosen menu before the
 * relationship-only endpoint is called; no menu sections are sent or rewritten. */
export default function LinkExistingMenuModal({ isOpen, product, onClose, onLinked }: LinkExistingMenuModalProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [bundles, setBundles] = useState<Product[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [variationId, setVariationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = bundles.find((bundle) => bundle.id === selectedId);
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

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId('');
    setVariationId('');
    setError(null);
    setIsLoading(true);
    void getAllMenuBundles()
      .then((items) => setBundles(items.filter((bundle) => isMenuBundle(bundle) && parentId(bundle) !== product.id)))
      .catch((caught) => setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles')))
      .finally(() => setIsLoading(false));
  }, [isOpen, product.id]);

  const save = async () => {
    if (!selectedId || (variationRequired && !variation)) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await linkMenuOffer(selectedId, {
        menuProductId: selectedId,
        parentOfferProductId: product.id,
        parentOfferVariationId: variation?.id ?? null,
      });
      if (!response.success) {
        setError(serverMessage(response) ?? tRef.current('error_loading_menu_bundles'));
        return;
      }
      onLinked();
      onClose();
    } catch (caught) {
      setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles'));
    } finally {
      setIsSaving(false);
    }
  };

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
            disabled={!selectedId || (variationRequired && !variation) || isSaving}
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
                  {bundle.name} · {bundle.basePrice}
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
          <p className={styles.summary}>
            {t('preview')}: {product.name} · {selected.name} · {selected.basePrice}{' '}
            <Link href={`/admin/menu-management/${selected.id}`} target="_blank">
              {t('details')}
            </Link>
          </p>
        )}
        {selected && selectedCategories !== undefined && (
          <div className={styles.categoryList} aria-label={t('category')}>
            {selectedCategories.length > 0 ? (
              selectedCategories.map((category) => (
                <span className={styles.category} key={category}>
                  {category}
                </span>
              ))
            ) : (
              <span className={styles.category}>{t('no_categories', 'No categories')}</span>
            )}
          </div>
        )}
        {selected && categoryMismatch && (
          <p role="alert" className={styles.warning}>
            {t(
              'category_mismatch_warning',
              'This menu has no category in common with the parent product. Linking will keep the menu formula unchanged.',
            )}
          </p>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
