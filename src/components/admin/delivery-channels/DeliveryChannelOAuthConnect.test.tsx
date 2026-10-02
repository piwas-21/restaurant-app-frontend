import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeliveryChannelOAuthConnect from './DeliveryChannelOAuthConnect';
import {
  deliveryChannelManagementService,
  isSafeUberAuthorizationUrl,
} from '@/services/deliveryChannelManagementService';
import type { DeliveryChannelManagementSummary } from '@/types/deliveryChannelManagement';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/deliveryChannelManagementService', () => ({
  deliveryChannelManagementService: { startOAuth: jest.fn() },
  isSafeUberAuthorizationUrl: jest.fn(),
  classifyDeliveryChannelMutationFailure: jest.fn(() => 'rejected'),
}));

const startOAuth = jest.mocked(deliveryChannelManagementService.startOAuth);
const safeAuthorizationUrl = jest.mocked(isSafeUberAuthorizationUrl);

function summary(connectionStatus: 'notConnected' | 'connected'): DeliveryChannelManagementSummary {
  return {
    provider: 'uber',
    enabled: true,
    sandboxOnly: true,
    connectionStatus,
    healthStatus: 'unknown',
    storeId: 'expected-store',
    currency: 'EUR',
    storeConfirmed: connectionStatus === 'connected',
    storeDisplayName: 'Sandbox store',
    integrationEnabled: false,
    isOrderManager: false,
    pendingMerchantActivation: false,
    requireManualAcceptance: connectionStatus === 'connected',
    paused: false,
    checkedAt: null,
    degradedReason: null,
    capabilities: {
      supportsSimpleItems: true,
      supportsVariations: true,
      supportsModifiers: false,
      supportsBundles: false,
      supportsItemAvailability: true,
      supportsStoreHoursEditing: false,
      supportsAutomaticAcceptance: true,
    },
    latestPublication: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  safeAuthorizationUrl.mockReturnValue(true);
  startOAuth.mockResolvedValue({
    flowId: 'flow-id',
    authorizationUrl: 'https://auth.uber.com/oauth/authorize',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
});

describe('DeliveryChannelOAuthConnect', () => {
  it('allows initial connection even while provider integration is disabled', () => {
    render(
      <DeliveryChannelOAuthConnect
        summary={summary('notConnected')}
        locale="en"
        canWrite
        menuProviderVerified={false}
        onRefresh={jest.fn().mockResolvedValue(false)}
      />,
    );

    expect(screen.getByRole('button', { name: 'deliveryChannels.connection.start' })).toBeInTheDocument();
  });

  it('requires provider-verified menu readback before order-acceptance authorization', async () => {
    const props = {
      summary: summary('connected'),
      locale: 'en',
      canWrite: true,
      onRefresh: jest.fn().mockResolvedValue(false),
    };
    const { rerender } = render(<DeliveryChannelOAuthConnect {...props} menuProviderVerified={false} />);

    expect(screen.queryByRole('button', { name: 'deliveryChannels.connection.enableOrders' })).not.toBeInTheDocument();
    expect(screen.getByText('deliveryChannels.connection.publishBeforeOrders')).toBeInTheDocument();

    rerender(<DeliveryChannelOAuthConnect {...props} menuProviderVerified />);
    fireEvent.click(screen.getByRole('button', { name: 'deliveryChannels.connection.enableOrders' }));

    await waitFor(() => expect(startOAuth).toHaveBeenCalledWith(true));
    expect(screen.getByRole('link', { name: 'deliveryChannels.connection.openProvider' })).toHaveAttribute(
      'target',
      '_blank',
    );
  });
});
