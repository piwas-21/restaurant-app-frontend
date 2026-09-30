export interface PublicPagedItems<T> {
  success: boolean;
  message?: string;
  data?: {
    items?: T[];
    totalPages?: number;
    totalCount?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface VisiblePages<T> {
  allItems: T[];
  items: T[];
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

const MAX_PUBLIC_PAGES = 20;

function totalPageCount<T>(first: NonNullable<PublicPagedItems<T>['data']>, pageSize: number): number {
  if (first.totalPages !== undefined) return first.totalPages;
  if (first.totalCount !== undefined) return Math.max(1, Math.ceil(first.totalCount / pageSize));
  return first.items && first.items.length < pageSize ? 1 : 0;
}

function isVerifiedEmpty<T>(data: NonNullable<PublicPagedItems<T>['data']>): boolean {
  return data.totalCount === 0 && data.totalPages === 0 && data.items?.length === 0;
}

function exceedsVerifiedLimit<T>(
  data: NonNullable<PublicPagedItems<T>['data']>,
  items: readonly T[],
  pages: number,
  pageSize: number,
): boolean {
  if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PUBLIC_PAGES || items.length > pageSize) return true;
  if (data.totalCount !== undefined && data.totalCount < 0) return true;
  return (
    data.totalCount !== undefined &&
    data.totalPages !== undefined &&
    pages !== Math.max(1, Math.ceil(data.totalCount / pageSize))
  );
}

function pageMetadataMatches<T>(
  pages: NonNullable<PublicPagedItems<T>['data']>[],
  pageSize: number,
  totalPages: number,
  totalCount: number | undefined,
): boolean {
  return pages.every(
    (data, index) =>
      (data.page === undefined || data.page === index + 1) &&
      (data.pageSize === undefined || data.pageSize === pageSize) &&
      (data.totalPages === undefined || data.totalPages === totalPages) &&
      (data.totalCount === undefined || data.totalCount === totalCount) &&
      (data.items?.length ?? pageSize + 1) <= pageSize,
  );
}

function uniqueStableIds<T extends { id: string }>(items: readonly T[]): boolean {
  const ids = items.map((item) => item.id);
  return ids.every((id) => typeof id === 'string' && id.trim().length > 0) && new Set(ids).size === ids.length;
}

function expectedCountMatches<T>(
  pages: NonNullable<PublicPagedItems<T>['data']>[],
  totalCount: number | undefined,
  pageSize: number,
  itemCount: number,
): boolean {
  const lastLength = pages[pages.length - 1]?.items?.length ?? pageSize;
  const evidenceKnown = totalCount !== undefined || pages[0]?.totalPages !== undefined || lastLength < pageSize;
  return evidenceKnown && (totalCount === undefined || itemCount === totalCount);
}

/** Load a bounded, verified guest collection before filtering and paging visible rows. */
export async function loadVisiblePages<
  T extends { id: string; isActive?: boolean; isAvailable?: boolean; isComponent?: boolean },
>(
  fetchPage: (page: number) => Promise<PublicPagedItems<T>>,
  requestedPage: number,
  requestedPageSize: number,
): Promise<VisiblePages<T>> {
  const firstResponse = await fetchPage(1);
  if (!firstResponse.success || !Array.isArray(firstResponse.data?.items)) {
    throw new Error(firstResponse.message || 'Failed to load the public menu');
  }
  const firstData = firstResponse.data;
  if (!firstData) throw new Error('Failed to load the public menu');
  const firstItems = firstData.items ?? [];
  const pageSize = firstData.pageSize ?? requestedPageSize;
  if (!Number.isInteger(pageSize) || pageSize < 1 || (firstData.page !== undefined && firstData.page !== 1)) {
    throw new Error('The public menu returned invalid pagination metadata');
  }
  const totalCount = firstData.totalCount;
  const totalPages = totalPageCount(firstData, pageSize);
  if (isVerifiedEmpty(firstData)) {
    return { allItems: [], items: [], currentPage: 1, totalPages: 1, totalCount: 0, pageSize };
  }
  if (exceedsVerifiedLimit(firstData, firstItems, totalPages, pageSize)) {
    throw new Error('The public menu exceeds the verified pagination limit');
  }

  const remaining = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => fetchPage(index + 2)));
  if (remaining.some((response) => !response.success || !Array.isArray(response.data?.items))) {
    throw new Error('The public menu could not be loaded completely');
  }
  const pages = [firstResponse, ...remaining].flatMap((response) => (response.data ? [response.data] : []));
  const allItems = pages.flatMap((data) => data.items ?? []);
  if (
    !pageMetadataMatches(pages, pageSize, totalPages, totalCount) ||
    !uniqueStableIds(allItems) ||
    !expectedCountMatches(pages, totalCount, pageSize, allItems.length)
  ) {
    throw new Error('The public menu returned incomplete or repeated pages');
  }

  const visible = allItems.filter(
    (item) => item.isActive !== false && item.isAvailable !== false && item.isComponent !== true,
  );
  const visibleTotalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(Math.max(1, Math.trunc(requestedPage)), visibleTotalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    allItems: visible,
    items: visible.slice(start, start + pageSize),
    currentPage,
    totalPages: visibleTotalPages,
    totalCount: visible.length,
    pageSize,
  };
}
