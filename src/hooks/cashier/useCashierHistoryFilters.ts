'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getCashierTenantContext } from '@/services/cashierService';
import { getErrorMessage } from '@/utils/apiClient';
import { CASHIER_TENANT_DAY_REFRESH_MS } from '@/lib/config';
import { daysBetween, isCalendarDay } from '@/utils/calendarDay';
import { historyDateWindow, readDay, readPage, readRange } from './cashierHistoryDates';
import { CASHIER_ORDERS_PAGE_SIZE, CASHIER_SEARCH_DEBOUNCE_MS } from './useCashierFilters';
import type { CashierHistoryFilters, CashierHistoryQuery, CashierHistoryRange } from './cashierHistoryTypes';
export type { CashierHistoryFilters, CashierHistoryQuery, CashierHistoryRange };
export function useCashierHistoryFilters(): CashierHistoryFilters {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const params = useMemo(() => new URLSearchParams(paramsString), [paramsString]);
  const range = readRange(params.get('range'));
  const fromDay = readDay(params.get('from'));
  const toDay = readDay(params.get('to'));
  const page = readPage(params.get('page'));
  const submittedSearch = params.get('search')?.trim() ?? '';
  const statusFilter = params.get('status') ?? 'all';
  const paymentStatusFilter = params.get('paymentStatus') ?? 'all';
  const orderTypeFilter = params.get('orderType') ?? 'all';
  const [searchQuery, setSearchQueryDraft] = useState(submittedSearch);
  const searchRef = useRef(submittedSearch);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tenantDay, setTenantDay] = useState<string>();
  const [tenantTimeZone, setTenantTimeZone] = useState<string>();
  const [tenantDayLoading, setTenantDayLoading] = useState(true);
  const [tenantDayError, setTenantDayError] = useState(false);
  const [tenantDayErrorMessage, setTenantDayErrorMessage] = useState<string | null>(null);
  const tenantRequestRef = useRef(0);
  const tenantContextSettledRef = useRef(false);
  const replaceParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(paramsString);
      Object.entries(changes).forEach(([key, value]) => {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      });
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [paramsString, pathname, router],
  );
  const loadTenantContext = useCallback(async () => {
    const requestId = ++tenantRequestRef.current;
    setTenantDayLoading(true);
    setTenantDayError(false);
    try {
      const context = await getCashierTenantContext();
      if (requestId !== tenantRequestRef.current) return;
      tenantContextSettledRef.current = true;
      if (context?.timeZone) setTenantTimeZone(context.timeZone);
      if (context?.date && isCalendarDay(context.date)) {
        setTenantDay(context.date);
        setTenantDayError(false);
        setTenantDayErrorMessage(null);
      } else {
        setTenantDayError(true);
        setTenantDayErrorMessage(null);
      }
    } catch (reason: unknown) {
      if (requestId !== tenantRequestRef.current) return;
      tenantContextSettledRef.current = true;
      setTenantDayError(true);
      setTenantDayErrorMessage(getErrorMessage(reason));
    } finally {
      if (requestId === tenantRequestRef.current) setTenantDayLoading(false);
    }
  }, []);
  useEffect(() => {
    if (range === 'custom') {
      if (!tenantContextSettledRef.current) void loadTenantContext();
      return () => {
        tenantRequestRef.current += 1;
      };
    }
    void loadTenantContext();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void loadTenantContext();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer =
      CASHIER_TENANT_DAY_REFRESH_MS === undefined
        ? undefined
        : window.setInterval(() => void loadTenantContext(), CASHIER_TENANT_DAY_REFRESH_MS);
    return () => {
      tenantRequestRef.current += 1;
      document.removeEventListener('visibilitychange', onVisible);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [loadTenantContext, range]);
  useEffect(() => {
    if (submittedSearch === searchRef.current) return;
    searchRef.current = submittedSearch;
    setSearchQueryDraft(submittedSearch);
  }, [submittedSearch]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  const commitSearch = useCallback(
    (value: string) => replaceParams({ search: value.trim() || null, page: null }),
    [replaceParams],
  );
  const setSearchQuery = useCallback(
    (value: string) => {
      searchRef.current = value;
      setSearchQueryDraft(value);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        commitSearch(value);
      }, CASHIER_SEARCH_DEBOUNCE_MS);
    },
    [commitSearch],
  );
  const submitSearch = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    commitSearch(searchRef.current);
  }, [commitSearch]);
  const setRange = useCallback(
    (value: CashierHistoryRange) => replaceParams({ range: value, page: null }),
    [replaceParams],
  );
  const setFromDay = useCallback(
    (value: string) => replaceParams({ from: value, range: 'custom', page: null }),
    [replaceParams],
  );
  const setToDay = useCallback(
    (value: string) => replaceParams({ to: value, range: 'custom', page: null }),
    [replaceParams],
  );
  const setStatusFilter = useCallback(
    (value: string) => replaceParams({ status: value === 'all' ? null : value, page: null }),
    [replaceParams],
  );
  const setPaymentStatusFilter = useCallback(
    (value: string) => replaceParams({ paymentStatus: value === 'all' ? null : value, page: null }),
    [replaceParams],
  );
  const setOrderTypeFilter = useCallback(
    (value: string) => replaceParams({ orderType: value === 'all' ? null : value, page: null }),
    [replaceParams],
  );
  const setPage = useCallback(
    (value: number) => replaceParams({ page: value > 1 ? String(value) : null }),
    [replaceParams],
  );
  const rangeReady =
    range === 'custom'
      ? isCalendarDay(fromDay) && isCalendarDay(toDay) && daysBetween(fromDay, toDay) >= 0
      : Boolean(tenantDay);
  const query = useMemo<CashierHistoryQuery>(() => {
    const dateWindow = historyDateWindow(range, tenantDay, fromDay, toDay);
    return {
      scope: 'All',
      page,
      pageSize: CASHIER_ORDERS_PAGE_SIZE,
      ...(submittedSearch ? { search: submittedSearch } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(paymentStatusFilter !== 'all' ? { paymentStatus: paymentStatusFilter } : {}),
      ...(orderTypeFilter !== 'all' ? { orderType: orderTypeFilter } : {}),
      ...dateWindow,
    };
  }, [fromDay, orderTypeFilter, page, paymentStatusFilter, range, statusFilter, submittedSearch, tenantDay, toDay]);
  const refreshTenantDay = useCallback(() => void loadTenantContext(), [loadTenantContext]);
  return {
    range,
    fromDay,
    toDay,
    searchQuery,
    statusFilter,
    paymentStatusFilter,
    orderTypeFilter,
    query,
    tenantDay,
    tenantTimeZone,
    tenantDayLoading,
    tenantDayError,
    tenantDayErrorMessage,
    rangeReady,
    setRange,
    setFromDay,
    setToDay,
    setSearchQuery,
    submitSearch,
    setStatusFilter,
    setPaymentStatusFilter,
    setOrderTypeFilter,
    setPage,
    refreshTenantDay,
  };
}
