'use client';

import { useTranslation } from 'react-i18next';
import { CASHIER_ORDERS_PAGE_SIZE_OPTIONS } from '@/hooks/cashier/useCashierFilters';
import styles from './CashierReadOnlyQueuePagination.module.css';

interface Pagination {
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

interface CashierReadOnlyQueuePaginationProps {
  readonly isHistory: boolean;
  readonly pagination: Pagination;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange?: (pageSize: number) => void;
}

export default function CashierReadOnlyQueuePagination({
  isHistory,
  pagination,
  onPageChange,
  onPageSizeChange,
}: CashierReadOnlyQueuePaginationProps) {
  const { t } = useTranslation();
  if (pagination.totalPages <= 1 && (isHistory || !onPageSizeChange)) return null;

  return (
    <div className={styles.pagination}>
      <nav className={styles.paginationControls} aria-label={t('cashier.workspace.pages_navigation')}>
        <button
          type="button"
          className={styles.navigationAction}
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
        >
          {t('previous')}
        </button>
        {getPaginationItems(pagination.page, pagination.totalPages).map((item) =>
          typeof item === 'number' ? (
            <button
              key={item}
              type="button"
              className={`${styles.paginationPage} ${item === pagination.page ? styles.paginationPageCurrent : ''}`}
              onClick={() => onPageChange(item)}
              aria-label={t('cashier.workspace.go_to_page', { page: item })}
              aria-current={item === pagination.page ? 'page' : undefined}
            >
              {item}
            </button>
          ) : (
            <span key={item} className={styles.paginationEllipsis} aria-hidden="true">
              …
            </span>
          ),
        )}
        <button
          type="button"
          className={styles.navigationAction}
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
        >
          {t('next')}
        </button>
      </nav>
      {!isHistory && onPageSizeChange && (
        <label className={styles.paginationPageSize}>
          <span>{t('cashier.workspace.groups_per_page')}</span>
          <select
            className={styles.paginationPageSizeSelect}
            value={pagination.pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {CASHIER_ORDERS_PAGE_SIZE_OPTIONS.map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function getPaginationItems(page: number, totalPages: number): Array<number | 'gap-left' | 'gap-right'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const visiblePages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sortedPages = [...visiblePages].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  return sortedPages.reduce<Array<number | 'gap-left' | 'gap-right'>>((items, current, index) => {
    const previous = sortedPages[index - 1];
    if (previous !== undefined && current - previous > 1) {
      if (current - previous === 2) items.push(previous + 1);
      else items.push(previous === 1 ? 'gap-left' : 'gap-right');
    }
    items.push(current);
    return items;
  }, []);
}
