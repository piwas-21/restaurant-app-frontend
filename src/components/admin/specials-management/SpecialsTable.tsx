'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import styles from '@/app/styles/AdminPage.module.css';
import type { SpecialProduct } from '@/hooks/useSpecialsManagement';

interface SpecialsTableProps {
  specialProducts: SpecialProduct[];
  isLoading: boolean;
  error: string | null;
  onSetFeatured: (productId: string) => void;
}

const SpecialsTable: React.FC<SpecialsTableProps> = ({ specialProducts, isLoading, error, onSetFeatured }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return <p>{t('loading_products', 'Loading special products...')}</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (specialProducts.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>{t('no_specials_found', 'No special items found. Mark items as special in Menu Management.')}</p>
      </div>
    );
  }

  return (
    <div className={styles.adminTableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>{t('product_name', 'Product Name')}</th>
            <th>{t('description', 'Description')}</th>
            <th>{t('price', 'Price')}</th>
            <th>{t('status', 'Status')}</th>
            <th>{t('actions_header', 'Actions')}</th>
          </tr>
        </thead>
        <tbody>
          {specialProducts.map((product) => (
            <tr key={product.id} className={product.isFeaturedSpecial ? styles.featuredRow : ''}>
              <td>
                {product.name}
                {product.isFeaturedSpecial && (
                  <span title={t('featured_special', 'Featured Special')}>
                    <Star
                      size={16}
                      fill="gold"
                      color="gold"
                      style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
                    />
                  </span>
                )}
              </td>
              <td>
                {product.description
                  ? product.description.length > 60
                    ? `${product.description.substring(0, 60)}...`
                    : product.description
                  : '-'}
              </td>
              <td>{formatPlainCurrency(product.basePrice)}</td>
              <td>
                {product.isFeaturedSpecial ? (
                  <span className={styles.featuredBadge}>{t('featured', 'Featured')}</span>
                ) : product.isAvailable ? (
                  <span className={styles.availableBadge}>{t('available', 'Available')}</span>
                ) : (
                  <span className={styles.unavailableBadge}>{t('unavailable', 'Unavailable')}</span>
                )}
              </td>
              <td className={styles.actionsCell}>
                {!product.isFeaturedSpecial && product.isAvailable && (
                  <button
                    className={`${styles.adminButton} ${styles.primary}`}
                    onClick={() => onSetFeatured(product.id)}
                    title={t('set_as_featured', 'Set as Featured')}
                  >
                    {t('set_featured', 'Set Featured')}
                  </button>
                )}
                {product.isFeaturedSpecial && (
                  <span className={styles.featuredLabel}>{t('currently_featured', 'Currently Featured')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SpecialsTable;
