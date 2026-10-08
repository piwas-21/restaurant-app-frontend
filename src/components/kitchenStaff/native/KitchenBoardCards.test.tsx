import { fireEvent, render, screen } from '@testing-library/react';
import type { KitchenBoardCorrection, KitchenBoardOrder } from '@/types/kitchenBoard';
import KitchenBoardCorrectionCard from './KitchenBoardCorrectionCard';
import KitchenBoardOrderCard from './KitchenBoardOrderCard';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; number?: number; target?: string; status?: string }) => {
      const routeLabels: Record<string, string> = {
        'nativeKitchenBoard.target.BackKitchen': 'Back kitchen',
        'nativeKitchenBoard.target.Default': 'Default kitchen',
        'nativeKitchenBoard.target.FrontKitchen': 'Front kitchen',
        'nativeKitchenBoard.target.General': 'General kitchen',
        'nativeKitchenBoard.route.NotConfigured': 'No printer configured',
        'nativeKitchenBoard.route.Printed': 'Printed',
        'nativeKitchenBoard.route.Queued': 'Queued',
        'nativeKitchenBoard.route.Received': 'Received by printer',
        'nativeKitchenBoard.route.Skipped': 'Skipped',
      };
      if (routeLabels[key]) return routeLabels[key];
      if (key === 'nativeKitchenBoard.correctionFor') return `Correction ${options?.number ?? ''}`;
      if (key === 'nativeKitchenBoard.routeStatus') return `${options?.target}: ${options?.status}`;
      return options?.defaultValue ?? key;
    },
  }),
}));

const correction: KitchenBoardCorrection = {
  workItemId: 'note-a',
  orderId: 'order-a',
  orderNumber: 'A-1',
  status: 'Cancelled',
  tableId: null,
  tableLabel: 'T-4',
  tableNumber: 4,
  serviceSessionId: 'visit-a',
  amendmentId: 'amendment-a',
  accountRevision: 9,
  orderVersion: 12,
  target: null,
  summary: '',
  withdrawn: true,
  isCompleted: true,
  canComplete: false,
  routeStatus: null,
  createdAt: '2026-10-08T12:00:00Z',
  changes: [],
};

const order: KitchenBoardOrder = {
  orderId: 'order-a',
  orderNumber: 'A-1',
  type: 'DineIn',
  status: 'Ready',
  tableId: null,
  tableLabel: 'T-4',
  tableNumber: 4,
  serviceSessionId: 'visit-a',
  createdAt: '2026-10-08T12:00:00Z',
  version: 3,
  isCompleted: false,
  completedAt: null,
  canComplete: true,
  requiredKitchenRoutes: [{ target: 'General', status: 'NotConfigured' }],
  items: [],
};

describe('native kitchen work cards', () => {
  it('shows withdrawn correction history without offering a work action', () => {
    render(<KitchenBoardCorrectionCard correction={correction} disabled={false} onComplete={jest.fn()} />);
    expect(screen.getByText('nativeKitchenBoard.withdrawnNotice')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'nativeKitchenBoard.acknowledgeCorrection' })).not.toBeInTheDocument();
  });

  it('requires an explicit acknowledgement and never labels a manual completion as printed', () => {
    const onComplete = jest.fn();
    render(
      <KitchenBoardOrderCard
        order={order}
        disabled={false}
        onPreparing={jest.fn()}
        onReady={jest.fn()}
        onComplete={onComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'nativeKitchenBoard.acknowledgeWork' }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/printed/i)).not.toBeInTheDocument();
  });

  it('localizes known printer targets and shows only the recorded route outcomes', () => {
    render(
      <KitchenBoardOrderCard
        order={{
          ...order,
          requiredKitchenRoutes: [
            { target: 'FrontKitchen', status: 'Queued' },
            { target: 'BackKitchen', status: 'Received' },
            { target: 'General', status: 'Printed' },
            { target: 'Default', status: 'Skipped' },
          ],
        }}
        disabled={false}
        onPreparing={jest.fn()}
        onReady={jest.fn()}
        onComplete={jest.fn()}
      />,
    );

    expect(screen.getByText('Front kitchen: Queued')).toBeInTheDocument();
    expect(screen.getByText('Back kitchen: Received by printer')).toBeInTheDocument();
    expect(screen.getByText('General kitchen: Printed')).toBeInTheDocument();
    expect(screen.getByText('Default kitchen: Skipped')).toBeInTheDocument();
  });
});
