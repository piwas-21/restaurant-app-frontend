import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderDto, PagedResult } from '@/types/order';
import CashierPriorDayReview from './CashierPriorDayReview';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const order = {
  id: 'older-order',
  dailyOrderNumber: 8,
  businessDate: '2026-10-14',
  orderNumber: 'full-reference',
  status: 'Preparing',
} as unknown as OrderDto;

function result(items: OrderDto[], hasNextPage = false): PagedResult<OrderDto> {
  return {
    items,
    totalCount: hasNextPage ? 55 : items.length,
    page: 1,
    pageSize: 50,
    totalPages: hasNextPage ? 2 : 1,
    hasNextPage,
    hasPreviousPage: false,
  };
}

it('shows the short number with its business date and exposes independent page loading', () => {
  const onReview = jest.fn();
  const onDismiss = jest.fn().mockResolvedValue(undefined);
  const onLoadMore = jest.fn().mockResolvedValue(undefined);
  render(
    <CashierPriorDayReview
      orders={result([order], true)}
      dismissingOrderId={null}
      error={null}
      hasMore
      isLoadingMore={false}
      onReview={onReview}
      onDismiss={onDismiss}
      onLoadMore={onLoadMore}
    />,
  );

  const details = screen.getByText('cashier.workspace.prior_day_title').closest('details');
  expect(details).toHaveProperty('open', false);
  fireEvent.click(screen.getByText('cashier.workspace.prior_day_title'));
  expect(details).toHaveProperty('open', true);
  expect(screen.getByRole('button', { name: 'cashier.workspace.prior_day_review' })).toBeInTheDocument();

  expect(screen.getByText('8')).toBeInTheDocument();
  expect(screen.getByText('2026-10-14')).toBeInTheDocument();
  expect(screen.queryByText('full-reference')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.prior_day_review' }));
  expect(onReview).toHaveBeenCalledWith('older-order');
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.prior_day_dismiss' }));
  expect(onDismiss).toHaveBeenCalledWith('older-order');
  fireEvent.click(screen.getByRole('button', { name: 'cashier.workspace.prior_day_load_more' }));
  expect(onLoadMore).toHaveBeenCalledTimes(1);
});

it('shows an archive read error even when no prior orders were returned', () => {
  render(
    <CashierPriorDayReview
      orders={result([])}
      dismissingOrderId={null}
      error="archive unavailable"
      hasMore={false}
      isLoadingMore={false}
      onReview={() => undefined}
      onDismiss={async () => undefined}
      onLoadMore={async () => undefined}
    />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('archive unavailable');
});
