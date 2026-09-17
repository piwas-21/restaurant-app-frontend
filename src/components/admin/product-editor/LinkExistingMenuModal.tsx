'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { getProducts } from '@/services/menuService';
import { linkMenuOffer } from '@/services/menuOfferFamilyService';
import { isMenuBundle } from '@/utils/productTypeFilter';
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

const parentId = (menu: Product): string | null =>
  menu.parentOfferProductId ?? menu.menuDefinition?.parentOfferProductId ?? null;

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
  const variation = product.variations.find((candidate: Variation) => candidate.id === variationId);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedId('');
    setVariationId('');
    setError(null);
    setIsLoading(true);
    void getProducts(1, 100, null, { type: 'Menu', includeComponents: true })
      .then((response) => {
        if (!response.success) {
          setError(response.message || tRef.current('error_loading_menu_bundles'));
          return;
        }
        setBundles(response.data.items.filter((bundle) => isMenuBundle(bundle) && parentId(bundle) !== product.id));
      })
      .catch((caught) => setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles')))
      .finally(() => setIsLoading(false));
  }, [isOpen, product.id]);

  const save = async () => {
    if (!selectedId) return;
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
      title={t('menu_bundles')}
      size="md"
      isPending={isSaving}
      footer={
        <div className={styles.footer}>
          <button type="button" className={modalStyles.cancelButton} onClick={onClose} disabled={isSaving}>
            {t('cancel')}
          </button>
          <button type="button" className={modalStyles.submitButton} onClick={save} disabled={!selectedId || isSaving}>
            {isSaving ? t('saving') : t('save')}
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
        {product.variations.length > 0 && (
          <FormField label={t('product_variations')}>
            <select value={variationId} onChange={(event) => setVariationId(event.target.value)}>
              <option value="">{t('select_product')}</option>
              {product.variations
                .filter((candidate) => Boolean(candidate.id))
                .map((candidate) => (
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
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
