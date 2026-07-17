'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import { deleteMenuBundle, getMenuBundleById, getProductById } from '@/services/menuService';
import { deleteProduct } from '@/services/productService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import ProductEditorPage from '@/components/admin/product-editor/ProductEditorPage';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { ProductDetails } from '@/app/admin/menu-management/interfaces';

const LIST_ROUTE = '/admin/menu-management';

/**
 * The product editor route (menu-bundles redesign #176, slice 7 PR2d). This page IS the
 * editor now (owner call, plan §7) — it absorbed the read-only detail view, mirroring the
 * slice-6 call where the customer sheet absorbed the details modal. It orchestrates only:
 * fetch, delete, navigate. The form lives in `useProductEditorForm`.
 */
const ProductEditorRoute = () => {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = params.productId as string;
  // `?type=menu` is the list's legacy hint. It only picks which endpoint to TRY; the fetched
  // product's own type decides what is rendered, so a wrong hint cannot mis-render.
  // PR2e drops the param once the list links carry no type.
  const typeHint = searchParams.get('type');

  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);

  const fetchProductData = useCallback(async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);
    try {
      const fetchAsBundle = isMenuBundle({ type: typeHint });
      const response = (await (fetchAsBundle ? getMenuBundleById(productId) : getProductById(productId))) as {
        success: boolean;
        data?: ProductDetails;
        message?: string;
      };

      if (response.success && response.data) {
        setProduct(response.data);
      } else {
        setError(response.message || t('product_not_found'));
      }
    } catch {
      setError(t('product_not_found'));
    } finally {
      setIsLoading(false);
    }
  }, [productId, typeHint, t]);

  useEffect(() => {
    // fetchProductData sets its own error state; fire-and-forget.
    void fetchProductData();
  }, [fetchProductData]);

  const handleConfirmDelete = async () => {
    if (!product) return;

    // Keyed off the fetched product, never the URL hint — the same rule PR2b established
    // for the list, where a mismatched discriminator deleted a bundle via deleteProduct.
    const response = (await (isMenuBundle(product) ? deleteMenuBundle(product.id) : deleteProduct(product.id))) as {
      success: boolean;
      message?: string;
      data?: string;
    };

    setIsConfirmationOpen(false);
    setResultModalMessage(response.data || response.message || '');
    setIsResultModalSuccess(response.success);
    setIsResultModalOpen(true);
    if (response.success) router.push(LIST_ROUTE);
  };

  if (isLoading) {
    return (
      <div className={styles.adminContainer}>
        <p>{t('loading_product_details')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.adminContainer}>
        <p className={styles.error}>{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.adminContainer}>
        <p>{t('product_not_found')}</p>
      </div>
    );
  }

  const productIsBundle = isMenuBundle(product);

  return (
    <>
      {/*
        Keyed by id so navigating between products remounts the form rather than resetting
        it — the resolver is chosen per kind at mount and must never be swapped underneath.
      */}
      <ProductEditorPage
        key={product.id}
        product={product}
        isBundle={productIsBundle}
        onSaved={fetchProductData}
        onDelete={() => setIsConfirmationOpen(true)}
        onBack={() => router.push(LIST_ROUTE)}
      />

      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmDelete}
        message={productIsBundle ? t('confirm_delete_menu_bundle_message') : t('confirm_delete_product_message')}
      />

      <ResultModal
        isOpen={isResultModalOpen}
        onClose={() => setIsResultModalOpen(false)}
        message={resultModalMessage}
        isSuccess={isResultModalSuccess}
      />
    </>
  );
};

/**
 * Matches the sibling list route's shape. The guard is NEW here: this route carried none,
 * so a direct URL reached the editor's chrome without an admin check (the API still refused
 * the writes). It edits products, so it gets the same guard the list has.
 */
const ProductEditorRoutePage = () => (
  <AdminAuthGuard>
    <Suspense fallback={<div>Loading...</div>}>
      <ProductEditorRoute />
    </Suspense>
  </AdminAuthGuard>
);

export default ProductEditorRoutePage;
