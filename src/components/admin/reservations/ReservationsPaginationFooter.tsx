'use client';

import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import styles from '@/app/admin/reservations-management/styles.module.css';

interface ReservationsPaginationFooterProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

/**
 * Pagination control + "showing X-Y of N items" caption. Extracted so
 * `reservations-management/page.tsx` stays under the 200-LOC page limit.
 */
export default function ReservationsPaginationFooter({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  isLoading,
  onPageChange,
}: ReservationsPaginationFooterProps) {
  const { t } = useTranslation();
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalCount);

  return (
    <>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} isLoading={isLoading} />
      {totalCount > 0 && (
        <p className={styles.paginationInfo}>
          {t('showing_items', {
            start,
            end,
            total: totalCount,
            defaultValue: `Showing ${start}-${end} of ${totalCount} items`,
          })}
        </p>
      )}
    </>
  );
}
