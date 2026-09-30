const PUBLIC_API_TIMEOUT_MS = 5_000;

export interface PublicCollection<T> {
  complete: boolean;
  items: T[];
  totalPages: number;
  totalCount: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function fetchPublicApiData(path: string): Promise<unknown | null> {
  const apiBase = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL)?.replace(/\/$/, '');
  if (!apiBase) return null;
  try {
    const response = await fetch(`${apiBase}${path}`, {
      next: { revalidate: 30, tags: ['public-discovery'] },
      signal: AbortSignal.timeout(PUBLIC_API_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!isRecord(body) || body.success === false || !('data' in body)) return null;
    return body.data;
  } catch (error) {
    console.warn(`Public discovery request failed for ${path}`, error);
    return null;
  }
}

function pageParts<T>(
  value: unknown,
): { items: T[]; page?: number; pageSize?: number; totalPages?: number; totalCount?: number } | null {
  if (!isRecord(value) || !Array.isArray(value.items) || !value.items.every(isRecord)) return null;
  const items = value.items as T[];
  const page = typeof value.page === 'number' ? value.page : undefined;
  const pageSize = typeof value.pageSize === 'number' ? value.pageSize : undefined;
  const totalPages = typeof value.totalPages === 'number' ? value.totalPages : undefined;
  const totalCount = typeof value.totalCount === 'number' ? value.totalCount : undefined;
  return { items, page, pageSize, totalPages, totalCount };
}

function stableId(value: unknown): string | null {
  if (!isRecord(value)) return null;
  if (typeof value.id === 'string' && value.id.trim()) return value.id;
  if (typeof value.productId === 'string' && value.productId.trim()) return value.productId;
  if (isRecord(value.anchor)) {
    if (typeof value.anchor.productId === 'string' && value.anchor.productId.trim()) return value.anchor.productId;
    if (typeof value.anchor.id === 'string' && value.anchor.id.trim()) return value.anchor.id;
  }
  return null;
}

interface CollectionPlan {
  pageSize: number;
  totalPages: number;
  totalCount: number;
}

function verifiedEmpty<T>(page: NonNullable<ReturnType<typeof pageParts<T>>>): boolean {
  return (
    page.totalCount === 0 &&
    page.totalPages === 0 &&
    page.items.length === 0 &&
    (page.page === undefined || page.page === 1) &&
    (page.pageSize === undefined || page.pageSize > 0)
  );
}

function resolvePlan<T>(
  first: NonNullable<ReturnType<typeof pageParts<T>>>,
  requestedPageSize: number,
  pageLimit: number,
): CollectionPlan | null {
  const pageSize = first.pageSize ?? requestedPageSize;
  const inferredPages =
    first.totalCount === undefined
      ? first.items.length < pageSize
        ? 1
        : 0
      : Math.max(1, Math.ceil(first.totalCount / pageSize));
  const totalPages = first.totalPages ?? inferredPages;
  const totalCount = first.totalCount ?? (totalPages === 1 ? first.items.length : 0);
  if (!validPlan(first, pageSize, totalPages, pageLimit)) return null;
  return { pageSize, totalPages, totalCount };
}

function validPlan<T>(
  first: NonNullable<ReturnType<typeof pageParts<T>>>,
  pageSize: number,
  totalPages: number,
  pageLimit: number,
): boolean {
  if (!Number.isInteger(pageSize) || pageSize < 1) return false;
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > pageLimit) return false;
  if (first.page !== undefined && first.page !== 1) return false;
  if (first.totalCount !== undefined && first.totalCount < 0) return false;
  if (first.totalPages !== undefined && first.totalPages < 1) return false;
  return (
    first.totalCount === undefined ||
    first.totalPages === undefined ||
    totalPages === Math.max(1, Math.ceil(first.totalCount / pageSize))
  );
}

function pagesMatchPlan<T>(
  pages: NonNullable<ReturnType<typeof pageParts<T>>>[],
  pageSize: number,
  totalPages: number,
  firstCount: number | undefined,
): boolean {
  return pages.every(
    (page, index) =>
      (page.page === undefined || page.page === index + 1) &&
      (page.pageSize === undefined || page.pageSize === pageSize) &&
      (page.totalPages === undefined || page.totalPages === totalPages) &&
      (page.totalCount === undefined || page.totalCount === firstCount) &&
      page.items.length <= pageSize,
  );
}

function uniqueStableIdentity<T>(items: readonly T[]): boolean {
  const ids = items.map(stableId);
  return ids.every((id): id is string => id !== null) && new Set(ids).size === ids.length;
}

export async function readPublicCollection<T>(
  pathForPage: (page: number) => string,
  pageSize: number,
  pageLimit: number,
): Promise<PublicCollection<T>> {
  const first = pageParts<T>(await fetchPublicApiData(pathForPage(1)));
  if (!first) return { complete: false, items: [], totalPages: 0, totalCount: 0 };
  if (verifiedEmpty(first)) {
    return { complete: true, items: [], totalPages: 0, totalCount: 0 };
  }
  const plan = resolvePlan(first, pageSize, pageLimit);
  if (!plan) return { complete: false, items: first.items, totalPages: 0, totalCount: first.totalCount ?? 0 };

  const remaining = await Promise.all(
    Array.from({ length: plan.totalPages - 1 }, (_, index) => fetchPublicApiData(pathForPage(index + 2))),
  );
  const parsedRemaining = remaining.map((page) => pageParts<T>(page));
  if (parsedRemaining.some((page) => page === null)) {
    return { complete: false, items: first.items, totalPages: plan.totalPages, totalCount: plan.totalCount };
  }
  const pages = [first, ...parsedRemaining.filter((page): page is NonNullable<typeof page> => page !== null)];
  const pageMetadataMatches = pagesMatchPlan(pages, plan.pageSize, plan.totalPages, first.totalCount);
  const items = pages.flatMap((page) => page.items);
  const finalPageHasRemainderEvidence = pages[pages.length - 1].items.length < plan.pageSize;
  const expectedCountKnown =
    first.totalCount !== undefined || first.totalPages !== undefined || finalPageHasRemainderEvidence;
  const expectedCount = first.totalCount ?? items.length;
  const exactCount = expectedCountKnown && items.length === expectedCount;
  return {
    complete: pageMetadataMatches && uniqueStableIdentity(items) && exactCount,
    items,
    totalPages: plan.totalPages,
    totalCount: first.totalCount ?? items.length,
  };
}
