/**
 * Generic API envelope and pagination wrappers. Extracted from types/order.ts
 * (Sprint 4/6 type-file split by domain).
 */

/**
 * Paged result
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}
