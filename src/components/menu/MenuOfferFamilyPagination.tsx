'use client';

import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import type { UsePublicOfferFamiliesReturn } from '@/hooks/usePublicOfferFamilies';
import styles from './MenuContent.module.css';

interface MenuOfferFamilyPaginationProps {
  state: Pick<
    UsePublicOfferFamiliesReturn,
    'currentPage' | 'totalPages' | 'totalCount' | 'pageSize' | 'onPageChange' | 'isLoading'
  >;
  hidden?: boolean;
}

/** Keeps the aggregate guest path paginated without hiding families beyond the first server page. */
export default function MenuOfferFamilyPagination({ state, hidden = false }: MenuOfferFamilyPaginationProps) {
  const { t } = useTranslation();
  if (hidden || state.totalCount <= 0) return null;

  const start = (state.currentPage - 1) * state.pageSize + 1;
  const end = Math.min(state.currentPage * state.pageSize, state.totalCount);

  return (
    <>
      {state.totalPages > 1 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          onPageChange={state.onPageChange}
          isLoading={state.isLoading}
        />
      )}
      <p className={styles.paginationInfo}>{t('showing_items', { start, end, total: state.totalCount })}</p>
    </>
  );
}
