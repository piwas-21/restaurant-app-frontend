'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export default function Pagination({ currentPage, totalPages, onPageChange, isLoading = false }: PaginationProps) {
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      // Show pages around current page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePrevious = () => {
    if (currentPage > 1 && !isLoading) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && !isLoading) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageClick = (page: number | string) => {
    if (typeof page === 'number' && page !== currentPage && !isLoading) {
      onPageChange(page);
    }
  };

  return (
    <nav className={styles.pagination} aria-label="Pagination Navigation">
      <button
        className={`${styles.pageButton} ${styles.navButton}`}
        onClick={handlePrevious}
        disabled={currentPage === 1 || isLoading}
        aria-label="Previous page"
        type="button"
      >
        <ChevronLeft size={20} />
      </button>

      <div className={styles.pageNumbers}>
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className={styles.ellipsis}>
                ...
              </span>
            );
          }

          return (
            <button
              key={page}
              className={`${styles.pageButton} ${page === currentPage ? styles.active : ''}`}
              onClick={() => handlePageClick(page)}
              disabled={isLoading}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? 'page' : undefined}
              type="button"
            >
              {page}
            </button>
          );
        })}
      </div>

      <button
        className={`${styles.pageButton} ${styles.navButton}`}
        onClick={handleNext}
        disabled={currentPage === totalPages || isLoading}
        aria-label="Next page"
        type="button"
      >
        <ChevronRight size={20} />
      </button>
    </nav>
  );
}
