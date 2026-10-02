import { applyClientFilterAndSort, buildServerFilters } from './adminOrdersFilters';
import type { OrderDto } from '@/types/order';

const clientFilters = {
  searchQuery: '',
  showFocusOnly: false,
  sortBy: 'date' as const,
  sortOrder: 'desc' as const,
};

it('sends a marketplace-only filter to the orders query instead of filtering a fetched page', () => {
  expect(
    buildServerFilters({
      selectedStatus: 'PendingApproval',
      selectedPaymentStatus: 'All',
      selectedOrderType: 'All',
      selectedMarketplaceOnly: true,
      dateRangeStart: null,
      dateRangeEnd: null,
    }),
  ).toEqual({ status: 'PendingApproval', marketplaceOnly: true });
});

it('matches a marketplace order by its provider display ID in the visible admin result set', () => {
  const marketplace = {
    orderNumber: '1042',
    externalOrder: { externalDisplayId: '9116D' },
  } as OrderDto;

  expect(applyClientFilterAndSort([marketplace], { ...clientFilters, searchQuery: '9116d' })).toEqual([marketplace]);
});
