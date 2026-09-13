import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderStatusBadge from './OrderStatusBadge';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('OrderStatusBadge', () => {
  it.each([
    ['PendingApproval', 'order_status_pending_approval', 'statusCompleted'],
    ['Preparing', 'order_status_preparing', 'statusPreparing'],
    ['OutForDelivery', 'order_status_in_transit', 'statusCompleted'],
    ['Delivered', 'order_status_delivered', 'statusCompleted'],
    ['Refunded', 'order_status_refunded', 'statusCompleted'],
  ])('keeps the shared fill class for %s', (status, label, className) => {
    render(<OrderStatusBadge status={status} />);
    expect(screen.getByText(label)).toHaveClass(className);
  });

  it('keeps an unknown status on the neutral design-system tone', () => {
    render(<OrderStatusBadge status="FutureStatus" />);
    expect(screen.getByText('FutureStatus')).toHaveClass('neutral');
    expect(screen.getByText('FutureStatus')).not.toHaveClass('statusCompleted');
  });
});
