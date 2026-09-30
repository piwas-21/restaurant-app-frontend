'use client';

import { useTranslation } from 'react-i18next';
import { usePathname, useSearchParams } from 'next/navigation';
import Pagination from '@/components/common/Pagination';
import type { UsePublicOfferFamiliesReturn } from '@/hooks/usePublicOfferFamilies';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { publicMenuPageHref } from '@/lib/publicRouteQuery';
import styles from './MenuContent.module.css';

interface MenuOfferFamilyPaginationProps {
  state: Pick<UsePublicOfferFamiliesReturn, 'currentPage' | 'totalPages' | 'totalCount' | 'onPageChange' | 'isLoading'>;
  hidden?: boolean;
}

/** Keeps the aggregate guest path paginated without hiding families beyond the first server page. */
export default function MenuOfferFamilyPagination({ state, hidden = false }: Readonly<MenuOfferFamilyPaginationProps>) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (hidden || state.totalCount <= 0) return null;
  const [locale, surface, ...rest] = pathname?.split('/').filter(Boolean) ?? [];
  const hrefForPage =
    isSupportedPublicLocale(locale ?? '') && surface === 'menu' && rest.length === 0
      ? (page: number) => publicMenuPageHref(locale, searchParams, 'products', page)
      : undefined;

  return (
    <>
      {state.totalPages > 1 && (
        <Pagination
          currentPage={state.currentPage}
          totalPages={state.totalPages}
          onPageChange={state.onPageChange}
          isLoading={state.isLoading}
          hrefForPage={hrefForPage}
        />
      )}
      <p className={styles.paginationInfo}>
        {t('menu_page_info', { page: state.currentPage, totalPages: state.totalPages })}
      </p>
    </>
  );
}
