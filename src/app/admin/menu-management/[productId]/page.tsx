'use client';

import React, { Suspense, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import { deleteMenuBundle } from '@/services/menuBundleService';
import { deleteProduct } from '@/services/productService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import ProductEditorPage from '@/components/admin/product-editor/ProductEditorPage';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { useProductEditorFetch } from '@/hooks/admin/useProductEditorFetch';

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
  const productId = params.productId as string;

  // The fetch, the kind-derivation and every refusal path live in the hook — see it for why the
  // RESOLVED `success:false` branch is the one that matters here.
  const { product, isLoading, error, refetch } = useProductEditorFetch(productId);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);

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
        onSaved={refetch}
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
