'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMenuManagement } from '@/hooks/useMenuManagement';
import { useOfferFamilyRows } from '@/hooks/useOfferFamilyRows';
import { deleteMenuBundle } from '@/services/menuBundleService';
import { deleteProduct } from '@/services/productService';
import { MenuTypeFilter, isMenuBundle } from '@/utils/productTypeFilter';
import styles from '@/app/styles/AdminPage.module.css';
import pageStyles from './MenuManagementPage.module.css';
import MenuCreateFlow from '@/components/admin/menu-management/MenuCreateFlow';
import MenuManagementToolbar from '@/components/admin/menu-management/MenuManagementToolbar';
import PageHeader from '@/components/admin/PageHeader';
import ProductsTable from '@/components/admin/menu-management/ProductsTable';
import MenuCatalogueSuggestions from '@/components/admin/menu-management/MenuCatalogueSuggestions';
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

  const { products, categories, selectedCategoryId, isLoading, error, handleCategoryChange, fetchProducts } =
    useMenuManagement(typeFilter);
  const { rows, currentPage, totalPages, totalCount, pageSize, searchQuery, setSearchQuery, handlePageChange } =
    useOfferFamilyRows(products);

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<PendingDelete | null>(null);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [resultModalMessage, setResultModalMessage] = useState('');
  const [isResultModalSuccess, setIsResultModalSuccess] = useState(false);

  // Edit NAVIGATES to the editor page; no `?type=` hint (PR2e) — the route derives the kind itself.
  const handleEdit = (product: Product) => {
    router.push(`/admin/menu-management/${product.id}`);
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
          <Link href="/admin/menu-management/catalogue" className={pageStyles.headerLink}>
            {t('browse_suggestions')}
          </Link>
          <MenuCreateFlow autoOpenQuickAdd={searchParams.get('new') === 'item'} onCreated={fetchProducts} />
        </PageHeader>
        <MenuManagementToolbar
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onCategoryChange={handleCategoryChange}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
        <MenuCatalogueSuggestions query={searchQuery} />
        <Link href="/admin/option-sets" className={pageStyles.libraryLink}>
          {t('option_sets_manage')}
        </Link>
        <div className={styles.adminContent}>
          <ProductsTable
            products={[]}
            rows={rows}
            isLoading={isLoading}
            error={error}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            typeFilter={typeFilter}
          />
          {/* Pagination */}
          {!isLoading && totalCount > 0 && (
            <>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isLoading={isLoading}
              />

              {/* Pagination Info */}
              {totalCount > 0 && (
                <p className={pageStyles.paginationInfo}>
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
