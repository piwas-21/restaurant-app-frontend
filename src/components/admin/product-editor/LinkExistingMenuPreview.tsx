'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/app/admin/menu-management/interfaces';
import { formatPlainCurrency } from '@/utils/currency';
import styles from './QuickMenuVersionModal.module.css';

interface LinkExistingMenuPreviewProps {
  readonly productName: string;
  readonly selected: Product;
  readonly currentParentName: string | null;
  readonly selectedCategories?: string[];
  readonly categoryMismatch: boolean;
}

export default function LinkExistingMenuPreview({
  productName,
  selected,
  currentParentName,
  selectedCategories,
  categoryMismatch,
}: LinkExistingMenuPreviewProps) {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.summary}>
        {t('preview')}: {productName} · {selected.name} · {formatPlainCurrency(selected.basePrice)}{' '}
        <Link href={`/admin/menu-management/${selected.id}`} target="_blank">
          {t('details')}
        </Link>
      </p>
      {currentParentName && (
        <p role="status" className={styles.warning}>
          {t('current_menu_parent', { parentName: currentParentName })}
        </p>
      )}
      {selectedCategories !== undefined && (
        <div className={styles.categoryList} aria-label={t('category')}>
          {selectedCategories.length > 0 ? (
            selectedCategories.map((category) => (
              <span className={styles.category} key={category}>
                {category}
              </span>
            ))
          ) : (
            <span className={styles.category}>{t('no_categories')}</span>
          )}
        </div>
      )}
      {categoryMismatch && (
        <p role="alert" className={styles.warning}>
          {t('category_mismatch_warning')}
        </p>
      )}
    </>
  );
}
