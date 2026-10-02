import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import DeliveryChannelOAuthCallback from './DeliveryChannelOAuthCallback';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';

const mockFlowId = '6d3d5e2b-5982-4edc-9a41-6685ad384c25';
const mockSupersededMessage =
  'A newer authorization link replaced this one. Return to Uber Eats management and check the latest connection.';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('flowId=6d3d5e2b-5982-4edc-9a41-6685ad384c25'),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      key === 'deliveryChannels.codes.AuthorizationSuperseded'
        ? 'A newer authorization link replaced this one. Return to Uber Eats management and check the latest connection.'
        : (options?.defaultValue ?? key),
    i18n: { resolvedLanguage: 'en', language: 'en' },
  }),
}));
jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/TenantLink', () => ({
  __esModule: true,
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
jest.mock('@/services/deliveryChannelManagementService', () => ({
  deliveryChannelManagementService: { getOAuthFlow: jest.fn() },
}));

const getOAuthFlow = jest.mocked(deliveryChannelManagementService.getOAuthFlow);

it('shows a superseded authorization as failed and tells the owner to check the latest link', async () => {
  getOAuthFlow.mockResolvedValue({
    flowId: mockFlowId,
    status: 'failed',
    storeId: '',
    storeConfirmed: false,
    createdAt: '2026-10-02T10:00:00.000Z',
    expiresAt: '2026-10-02T10:10:00.000Z',
    completedAt: '2026-10-02T10:01:00.000Z',
    errorCode: 'AuthorizationSuperseded',
  });

  render(<DeliveryChannelOAuthCallback />);

  expect(await screen.findByText(mockSupersededMessage)).toBeInTheDocument();
  expect(screen.getByText('deliveryChannels.callback.state.failed')).toBeInTheDocument();
  expect(screen.queryByText('deliveryChannels.callback.state.connected')).not.toBeInTheDocument();
  await waitFor(() => expect(getOAuthFlow).toHaveBeenCalledWith(mockFlowId));
});
