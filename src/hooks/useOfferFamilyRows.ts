'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Product } from '@/app/admin/menu-management/interfaces';
import { filterOfferRows, groupProductsIntoOfferRows, type GroupedOfferRow } from '@/utils/offerFamilyGrouping';

const PAGE_SIZE = 20;

/** Groups the complete catalogue before applying the admin's local search and pagination. */
export function useOfferFamilyRows(products: Product[]) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const groupedRows = useMemo(() => groupProductsIntoOfferRows(products), [products]);
  const filteredRows = useMemo(() => filterOfferRows(groupedRows, searchQuery), [groupedRows, searchQuery]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const rows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [products, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return {
    rows,
    currentPage,
    totalPages,
    totalCount: filteredRows.length,
    pageSize: PAGE_SIZE,
    searchQuery,
    setSearchQuery,
    handlePageChange,
  } satisfies {
    rows: GroupedOfferRow[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    pageSize: number;
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    handlePageChange: (page: number) => void;
  };
}
