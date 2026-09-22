import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { ServerServiceTask } from '@/types/serverTasks';
import ServerTaskCard from './ServerTaskCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: { count?: number; table?: string; order?: string }) => {
      let value = fallback ?? key;
      if (options?.count !== undefined) value = value.replace('{{count}}', String(options.count));
      if (options?.table) value = value.replace('{{table}}', options.table);
      if (options?.order) value = value.replace('{{order}}', options.order);
      return value;
    },
  }),
}));

const baseTask: ServerServiceTask = {
  orderId: 'order-1',
  orderNumber: 'A-01',
  orderType: 'DineIn',
  status: 'Ready',
  bucket: 'Ready',
  actionableAt: '2026-09-22T09:00:00Z',
  ageSeconds: 3_600,
  tableId: 'table-1',
  tableLabel: 'Table 1',
  tableNumber: 1,
  serviceSessionId: 'session-1',
  total: 25,
  remainingAmount: 25,
  version: 7,
  routingState: 'Complete',
  hasRequiredRoutingException: false,
  hasOptionalRoutingException: false,
  routing: [],
  permittedDeliveryActions: [{ action: 'HandOver', allowed: true, reasonCode: null, targetStatus: 'Completed' }],
};

describe('ServerTaskCard', () => {
  it('shows server-computed age and keeps the dine-in context deep link', () => {
    render(<ServerTaskCard task={baseTask} isBusy={false} onDeliver={jest.fn()} />);

    expect(screen.getByText('1 h')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Table 1' })).toHaveAttribute(
      'href',
      '/server/tables/table-1?serviceSessionId=session-1&orderId=order-1',
    );
  });

  it('disables delivery with the exact server refusal reason and does not link takeaway to a new-order composer', () => {
    const task: ServerServiceTask = {
      ...baseTask,
      orderType: 'Takeaway',
      tableId: null,
      tableLabel: null,
      serviceSessionId: null,
      permittedDeliveryActions: [
        { action: 'HandOver', allowed: false, reasonCode: 'KitchenReleaseRequired', targetStatus: null },
      ],
    };
    render(<ServerTaskCard task={task} isBusy={false} onDeliver={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Kitchen release is required.' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: /takeaway/i })).not.toBeInTheDocument();
  });
});
