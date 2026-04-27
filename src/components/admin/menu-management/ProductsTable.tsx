'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import { Product } from '@/app/admin/menu-management/interfaces';

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  onEdit: (productId: string) => void;
  onDelete: (productId: string) => void;
  activeTab?: 'products' | 'menus';
}

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  error,
  onEdit,
  onDelete,
  activeTab = 'products',
}) => {
  const { t } = useTranslation();

  const loadingMessage = activeTab === 'menus' ? t('loading_menu_bundles') : t('loading_products');
  const emptyMessage = activeTab === 'menus' ? t('no_menu_bundles_found') : t('no_products_found');

  if (isLoading) return <p>{loadingMessage}</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.adminTableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>{t('product_name')}</th>
            <th>{t('base_price')}</th>
            <th>{t('active')}</th>
            <th>{t('available')}</th>
            <th>{t('actions_header')}</th>
          </tr>
        </thead>
        <tbody>
          {products.length > 0 ? (
            products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>CHF {product.basePrice.toFixed(2)}</td>
                <td>{product.isActive ? t('yes') : t('no')}</td>
                <td>{product.isAvailable ? t('yes') : t('no')}</td>
                <td className={styles.actionsCell}>
                  <button onClick={() => onEdit(product.id)} className={`${styles.adminButton} ${styles.edit}`}>
                    {t('edit')}
                  </button>
                  <button onClick={() => onDelete(product.id)} className={`${styles.adminButton} ${styles.delete}`}>
                    {t('delete')}
                  </button>
                  <Link
                    href={`/admin/menu-management/${product.id}?type=${activeTab === 'menus' ? 'menu' : 'product'}`}
                    className={`${styles.adminButton} ${styles.view}`}
                  >
                    {t('details')}
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;
