import { render, screen } from '@testing-library/react';
import DeliveryChannelExceptionInbox from './DeliveryChannelExceptionInbox';
import type { DeliveryChannelException } from '@/types/deliveryChannelExceptions';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const exception: DeliveryChannelException = {
  id: 'exception-1',
  kind: 'import',
  severity: 'critical',
  status: 'open',
  code: 'DeliveryUncertain',
  title: 'Provider import needs review',
  detail: 'Safe server copy',
  createdAt: '2026-10-02T10:00:00Z',
  updatedAt: '2026-10-02T10:01:00Z',
  providerOrderId: 'uber-order-1',
  localOrderId: 'sofra-order-1',
  canReconcile: false,
  automaticRetryBlocked: true,
};

describe('DeliveryChannelExceptionInbox', () => {
  it('shows translated manual-review guidance and links to the existing order without offering readback for imports', () => {
    render(
      <DeliveryChannelExceptionInbox
        items={[exception]}
        checkedAt="2026-10-02T10:01:00Z"
        stale={false}
        hasMore={false}
        loadingMore={false}
        busy={null}
        feedback={null}
        locale="en"
        onReconcile={jest.fn()}
        onLoadMore={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'deliveryChannels.codes.DeliveryUncertain' })).toBeInTheDocument();
    expect(screen.getByText('deliveryChannels.exceptions.recovery.import')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'deliveryChannels.exceptions.openOrderQueue' })).toHaveAttribute(
      'href',
      '/en/admin/orders-management',
    );
    expect(
      screen.queryByRole('button', { name: 'deliveryChannels.exceptions.checkProviderState' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Safe server copy')).not.toBeInTheDocument();
  });
});
