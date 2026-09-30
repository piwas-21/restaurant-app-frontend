'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  hrefForPage?: (page: number) => string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
  hrefForPage,
}: PaginationProps) {
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
      {pageControl(
        currentPage > 1 ? currentPage - 1 : null,
        hrefForPage,
        styles.navButton,
        styles.pageButton,
        isLoading,
        handlePrevious,
        <ChevronLeft size={20} />,
        'Previous page',
      )}

      <div className={styles.pageNumbers}>
        {getPageNumbers().map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className={styles.ellipsis}>
                ...
              </span>
            );
          }

          const target = page as number;
          const className = `${styles.pageButton} ${target === currentPage ? styles.active : ''}`;
          return hrefForPage ? (
            <a
              key={target}
              href={hrefForPage(target)}
              className={className}
              onClick={(event) => {
                event.preventDefault();
                handlePageClick(target);
              }}
              aria-label={`Page ${target}`}
              aria-current={target === currentPage ? 'page' : undefined}
              aria-disabled={isLoading || undefined}
            >
              {target}
            </a>
          ) : (
            <button
              key={target}
              className={className}
              onClick={() => handlePageClick(target)}
              disabled={isLoading}
              aria-label={`Page ${target}`}
              aria-current={target === currentPage ? 'page' : undefined}
              type="button"
            >
              {target}
            </button>
          );
        })}
      </div>

      {pageControl(
        currentPage < totalPages ? currentPage + 1 : null,
        hrefForPage,
        styles.navButton,
        styles.pageButton,
        isLoading,
        handleNext,
        <ChevronRight size={20} />,
        'Next page',
      )}
    </nav>
  );
}

function pageControl(
  page: number | null,
  hrefForPage: PaginationProps['hrefForPage'],
  navigationClass: string,
  pageClass: string,
  isLoading: boolean,
  onClick: () => void,
  icon: React.ReactNode,
  label: string,
) {
  const className = `${pageClass} ${navigationClass}`;
  if (hrefForPage && page !== null) {
    return (
      <a
        href={hrefForPage(page)}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          onClick();
        }}
        aria-label={label}
        aria-disabled={isLoading || undefined}
      >
        {icon}
      </a>
    );
  }
  return (
    <button
      className={className}
      onClick={onClick}
      disabled={page === null || isLoading}
      aria-label={label}
      type="button"
    >
      {icon}
    </button>
  );
}
