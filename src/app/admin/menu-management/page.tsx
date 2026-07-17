'use client';

import React, { useState, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMenuManagement } from '@/hooks/useMenuManagement';
import { deleteMenuBundle } from '@/services/menuService';
import { deleteProduct } from '@/services/productService';
import {
  MENU_BUNDLE_TYPE,
  MENU_TYPE_FILTERS,
  MENU_TYPE_FILTER_LABEL_KEYS,
  MenuTypeFilter,
  isMenuBundle,
} from '@/utils/productTypeFilter';
import styles from '@/app/styles/AdminPage.module.css';
import CreateProductModal from '@/components/admin/CreateProductModal';
import CreateMenuBundleModal from '@/components/admin/CreateMenuBundleModal';
import PageHeader from '@/components/admin/PageHeader';
import ProductsTable from '@/components/admin/menu-management/ProductsTable';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import ResultModal from '@/components/common/ResultModal';
import Pagination from '@/components/common/Pagination';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import { Product, PendingDelete } from '@/app/admin/menu-management/interfaces';

const MenuManagementContent = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryName = searchParams.get('categoryName');
  const [typeFilter, setTypeFilter] = useState<MenuTypeFilter>('all');

  const {
    products,
    categories,
    selectedCategoryId,
    isLoading,
    error,
    currentPage,
    totalPages,
    totalCount,
    pageSize,
    handleCategoryChange,
    handlePageChange,
    fetchProducts,
  } = useMenuManagement(typeFilter);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateMenuModalOpen, setIsCreateMenuModalOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<PendingDelete | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);

  // Edit NAVIGATES to the editor page (slice 7 PR2d) instead of opening a modal — the page
  // is the editor now, with one page-level Save (owner call, plan §7).
  //
  // The ROW still carries the kind, exactly as PR2b established: a `.find()` by id can miss
  // when the list refetches, and `getProductById` has no type filter, so it would hand back
  // a bundle as a ProductDto. The `?type=` hint only picks which endpoint the page TRIES;
  // the fetched product's own type decides what renders, so a stale hint cannot mis-render.
  // PR2e drops the param entirely.
  const handleEdit = (product: Product) => {
    const query = isMenuBundle(product) ? `?type=${MENU_BUNDLE_TYPE}` : '';
    router.push(`/admin/menu-management/${product.id}${query}`);
  };

  // Kind captured at CLICK time: the confirm modal has no focus trap, so the chips stay
  // keyboard-reachable and the list can refetch before Confirm — see the miss above.
  const handleDeleteClick = (product: Product) => {
    setProductToDelete({ id: product.id, isBundle: isMenuBundle(product) });
    setIsConfirmationOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (productToDelete) {
      const { id, isBundle } = productToDelete;
      const response = (await (isBundle ? deleteMenuBundle(id) : deleteProduct(id))) as {
        success: boolean;
        message?: string;
        data?: string;
      };

      setIsConfirmationOpen(false);
      setResultModalMessage(response.data || response.message || '');
      setIsResultModalSuccess(response.success);
      setIsResultModalOpen(true);
      if (response.success) {
        void fetchProducts();
      }
    }
  };

  const pageTitle = categoryName ? `${t('menu_items_for')} "${categoryName}"` : t('admin_menu_management_title');

  return (
    <>
      <div className={styles.adminContainer}>
        <PageHeader title={pageTitle}>
          <div className={styles.pageActions}>
            {/* fieldset+legend IS the grouping semantic — no role="group" needed (S6819).
                The legend names what is filtered; "All Types" would name it after an option. */}
            <fieldset className={`${styles.tabs} ${styles.chipGroup}`}>
              <legend className="sr-only">{t('product_type')}</legend>
              {MENU_TYPE_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={typeFilter === filter}
                  className={`${styles.tabButton} ${typeFilter === filter ? styles.activeTab : ''}`}
                  onClick={() => setTypeFilter(filter)}
                >
                  {t(MENU_TYPE_FILTER_LABEL_KEYS[filter])}
                </button>
              ))}
            </fieldset>

            {/* Category filter — applies to every chip now that one endpoint serves them all */}
            <select onChange={handleCategoryChange} value={selectedCategoryId || 'all'} className={styles.adminSelect}>
              <option value="all">{t('all_categories_nav')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {/* Both create actions always show: the filter is a VIEW, not a mode, and
                hiding one behind it is what made the old tabs feel modal. PR2c collapses
                this pair into one "New product" → type choice. */}
            <div className={styles.tooltipContainer}>
              <button className={`${styles.adminButton} ${styles.add}`} onClick={() => setIsCreateModalOpen(true)}>
                {t('create_new_product')}
              </button>
              <button className={`${styles.adminButton} ${styles.add}`} onClick={() => setIsCreateMenuModalOpen(true)}>
                {t('create_menu_bundle')}
              </button>
            </div>
          </div>
        </PageHeader>
        <div className={styles.adminContent}>
          <ProductsTable
            products={products}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            typeFilter={typeFilter}
          />

          {/* Pagination */}
          {!isLoading && products.length > 0 && (
            <>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />

              {/* Pagination Info */}
              {totalCount > 0 && (
                <p style={{ textAlign: 'center', marginTop: '1rem', color: '#666' }}>
                  {t('showing_items', {
                    start: (currentPage - 1) * pageSize + 1,
                    end: Math.min(currentPage * pageSize, totalCount),
                    total: totalCount,
                    defaultValue: `Showing ${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} items`,
                  })}
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <CreateProductModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProductCreated={fetchProducts}
        categoryId={selectedCategoryId}
      />
      <CreateMenuBundleModal
        isOpen={isCreateMenuModalOpen}
        onClose={() => setIsCreateMenuModalOpen(false)}
        onProductCreated={fetchProducts}
        categoryId={selectedCategoryId}
      />
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        onClose={() => setIsConfirmationOpen(false)}
        onConfirm={handleConfirmDelete}
        message={t('delete_product_confirmation_message')}
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

const MenuManagementPage = () => (
  <AdminAuthGuard>
    <Suspense fallback={<div>Loading...</div>}>
      <MenuManagementContent />
    </Suspense>
  </AdminAuthGuard>
);

export default MenuManagementPage;
