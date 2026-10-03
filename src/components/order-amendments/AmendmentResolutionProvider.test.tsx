import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { pendingResolutionFixture, resolutionIds } from '@/lib/__fixtures__/amendmentResolution';
import { persistPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import AmendmentResolutionEntry from './AmendmentResolutionEntry';
import AmendmentResolutionProvider from './AmendmentResolutionProvider';

const mockAuth = jest.fn();
const mockActor = jest.fn();
const mockModal = jest.fn();
let mockEnabled = true;
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => mockAuth() }));
jest.mock('@/hooks/accountPayments/useAccountPaymentActor', () => ({ useAccountPaymentActor: () => mockActor() }));
jest.mock('@/hooks/orderAmendments/useOrderAmendmentTranslations', () => ({
  useOrderAmendmentTranslations: () => ({ ready: true, failed: false, retry: jest.fn() }),
}));
jest.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ orderAmendmentsV1: mockEnabled }),
}));
jest.mock('./AmendmentResolutionModal', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockModal(props);
    return <div>Recovery modal</div>;
  },
}));
const record = {
  amendmentId: resolutionIds.amendment,
  financialResolution: {
    currency: 'CHF',
    potentialCreditMinor: 1000,
    resolutionStatus: 'Pending',
  },
} as OrderAmendmentHistory;
function workspace() {
  return (
    <AmendmentResolutionProvider orderId={resolutionIds.order} onChanged={jest.fn()}>
      <AmendmentResolutionEntry record={record} />
    </AmendmentResolutionProvider>
  );
}

describe('same-actor Admin financial recovery entry', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    window.sessionStorage.clear();
    mockEnabled = true;
    mockAuth.mockReturnValue({ isLoading: false, user: { role: 'Admin' } });
    mockActor.mockReturnValue({ actorId: resolutionIds.actor, status: 'ready', retry: jest.fn() });
  });
  it('offers new reviews only after the actor-scoped inventory proves no unresolved original', async () => {
    render(workspace());
    await waitFor(() => expect(screen.getByRole('button', { name: 'orderAmendments.resolution_open' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_open' }));
    expect(mockModal).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: resolutionIds.actor,
        orderId: resolutionIds.order,
        amendmentId: resolutionIds.amendment,
        expected: { currency: 'CHF', creditMinor: 1000 },
        enabled: true,
      }),
    );
  });
  it('recovers the original journal while the feature is off and isolates a new signed-in actor', async () => {
    expect(persistPendingAmendmentResolution(pendingResolutionFixture())).toBe(true);
    mockEnabled = false;
    const { rerender } = render(workspace());
    fireEvent.click(await screen.findByRole('button', { name: 'orderAmendments.resolution_recover' }));
    expect(mockModal).toHaveBeenLastCalledWith(
      expect.objectContaining({ actorId: resolutionIds.actor, enabled: false }),
    );
    mockActor.mockReturnValue({ actorId: resolutionIds.other, status: 'ready', retry: jest.fn() });
    rerender(workspace());
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'orderAmendments.resolution_recover' })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText('Recovery modal')).not.toBeInTheDocument();
  });
  it('holds new money actions when storage enumeration cannot prove there is no original journal', async () => {
    window.sessionStorage.setItem('positive-control', '{}');
    jest.spyOn(Storage.prototype, 'key').mockImplementation(() => {
      throw new Error('storage denied');
    });
    render(workspace());
    expect(await screen.findByText('orderAmendments.resolution_storage_failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'orderAmendments.resolution_open' })).toBeDisabled();
    expect(mockModal).not.toHaveBeenCalled();
  });
  it.each(['Server', 'Cashier'])('keeps refund authority with Admin for %s', (role) => {
    mockAuth.mockReturnValue({ isLoading: false, user: { role } });
    render(workspace());
    expect(screen.getByText('orderAmendments.resolution_admin_required')).toBeInTheDocument();
    expect(mockActor).not.toHaveBeenCalled();
    expect(mockModal).not.toHaveBeenCalled();
  });
});
