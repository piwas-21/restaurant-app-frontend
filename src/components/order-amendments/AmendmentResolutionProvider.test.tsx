import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  pendingResolutionFixture,
  resolutionIds,
  resolutionResultFixture,
} from '@/lib/__fixtures__/amendmentResolution';
import { persistPendingAmendmentResolution, readPendingAmendmentResolution } from '@/lib/pendingAmendmentResolution';
import type { OrderAmendmentHistory } from '@/types/orderAmendment';
import AmendmentResolutionEntry from './AmendmentResolutionEntry';
import AmendmentResolutionProvider from './AmendmentResolutionProvider';

const mockAuth = jest.fn();
const mockActor = jest.fn();
const mockModal = jest.fn();
const mockList = jest.fn();
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
jest.mock('@/services/amendmentResolutionRecoveryService', () => ({
  listAmendmentResolutionRecovery: (...args: unknown[]) => mockList(...args),
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
    mockList.mockResolvedValue([]);
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
    expect(mockList).not.toHaveBeenCalled();
  });
  it('discovers and explicitly restores an accepted operation after tab storage loss with writes disabled', async () => {
    const result = {
      ...resolutionResultFixture(),
      state: 'Processing',
      resolvedAt: null,
      refundLegs: resolutionResultFixture().refundLegs.map((leg) => ({
        ...leg,
        state: 'Processing',
        resolvedAt: null,
      })),
    };
    const pending = { ...pendingResolutionFixture(), operationId: resolutionIds.operation };
    mockList.mockResolvedValue([{ pending, result }]);
    mockEnabled = false;
    render(workspace());
    const recover = await screen.findByRole('button', { name: 'orderAmendments.resolution_recover' });
    expect(readPendingAmendmentResolution(resolutionIds.actor, resolutionIds.order, resolutionIds.amendment)).toEqual({
      status: 'none',
    });
    fireEvent.click(recover);
    expect(
      readPendingAmendmentResolution(resolutionIds.actor, resolutionIds.order, resolutionIds.amendment),
    ).toMatchObject({ status: 'pending', value: pending });
    expect(mockModal).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, actorId: resolutionIds.actor }));
  });
  it('blocks a new review if the remote owner inventory is unavailable even with empty storage', async () => {
    mockList.mockRejectedValue(new Error('private-provider-error'));
    render(workspace());
    await screen.findByText('error_unexpected');
    expect(screen.getByRole('button', { name: 'orderAmendments.resolution_open' })).toBeDisabled();
    expect(screen.queryByText('private-provider-error')).not.toBeInTheDocument();
    expect(mockModal).not.toHaveBeenCalled();
  });
  it('does not open remote recovery until its original journal can be saved', async () => {
    const result = {
      ...resolutionResultFixture(),
      state: 'Processing',
      resolvedAt: null,
      refundLegs: resolutionResultFixture().refundLegs.map((leg) => ({
        ...leg,
        state: 'Processing',
        resolvedAt: null,
      })),
    };
    mockList.mockResolvedValue([
      { pending: { ...pendingResolutionFixture(), operationId: resolutionIds.operation }, result },
    ]);
    render(workspace());
    const recover = await screen.findByRole('button', { name: 'orderAmendments.resolution_recover' });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('write failed');
    });
    fireEvent.click(recover);
    expect(await screen.findByText('orderAmendments.resolution_storage_failed')).toBeInTheDocument();
    expect(mockModal).not.toHaveBeenCalled();
  });
});
