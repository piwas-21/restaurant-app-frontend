import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '@/utils/apiClient';
import MarketplacePendingInbox from './MarketplacePendingInbox';
import { getOrders } from '@/services/orderService';

jest.mock('@/services/orderService', () => ({ getOrders: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const mockGetOrders = jest.mocked(getOrders);

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => jest.restoreAllMocks());

it('reads an exact one-row pending marketplace count and opens or clears the filtered inbox', async () => {
  mockGetOrders.mockResolvedValue({
    items: [],
    totalCount: 4,
    page: 1,
    pageSize: 1,
    totalPages: 4,
    hasNextPage: true,
    hasPreviousPage: false,
  });
  const onSelect = jest.fn();
  const onClear = jest.fn();
  const view = render(<MarketplacePendingInbox active={false} onSelect={onSelect} onClear={onClear} />);

  const button = await screen.findByRole('button', { name: /marketplaceStaff\.pending_count/ });
  expect(mockGetOrders).toHaveBeenCalledWith({
    scope: 'Operational',
    marketplaceOnly: true,
    status: 'PendingApproval',
    page: 1,
    pageSize: 1,
  });
  expect(button).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(button);
  expect(onSelect).toHaveBeenCalledTimes(1);

  view.rerender(<MarketplacePendingInbox active onSelect={onSelect} onClear={onClear} />);
  fireEvent.click(screen.getByRole('button', { name: /marketplaceStaff\.pending_active/ }));
  expect(onClear).toHaveBeenCalledTimes(1);
});

it('hides the shortcut when there are no pending marketplace orders', async () => {
  mockGetOrders.mockResolvedValue({
    items: [],
    totalCount: 0,
    page: 1,
    pageSize: 1,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  render(<MarketplacePendingInbox active={false} onSelect={jest.fn()} onClear={jest.fn()} />);
  await screen.findByText('marketplaceStaff.pending_loading');
  await waitFor(() => expect(screen.queryByRole('button')).not.toBeInTheDocument());
});

it('keeps the filter reachable and surfaces a failed count request', async () => {
  mockGetOrders.mockRejectedValue(new ApiError(503, 'Marketplace count unavailable'));
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

  render(<MarketplacePendingInbox active={false} onSelect={jest.fn()} onClear={jest.fn()} />);

  expect(await screen.findByText('Marketplace count unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /marketplaceStaff\.pending_unavailable/ })).toBeInTheDocument();
});
