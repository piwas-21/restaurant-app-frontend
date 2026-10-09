import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import { TableGuestFeatureProvider } from '@/contexts/TableGuestFeatureContext';
import { TableGuestVisitProvider } from '@/contexts/TableGuestVisitProvider';
import { basketService } from '@/services/basketService';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import { useTableGuestRoundSubmission } from './useTableGuestRoundSubmission';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import type { BasketDto } from '@/types/basket';
import type { TableGuestAccountDto } from '@/types/tableGuestVisit';
import { ApiError } from '@/utils/apiClient';
import { OrderType } from '@/types/order';

jest.mock('@/services/basketService', () => ({ basketService: { getBasket: jest.fn() } }));
jest.mock('@/services/orderTypeConfigurationService', () => ({
  orderTypeConfigurationService: { getEnabled: jest.fn() },
}));
jest.mock('@/services/tableGuestVisitService', () => ({
  isExpiredVisitError: jest.fn(() => false),
  isUnavailableVisitError: jest.fn(() => false),
  tableGuestVisitService: {
    joinTableGuestVisit: jest.fn(),
    getTableGuestAccount: jest.fn(),
    createTableGuestRound: jest.fn(),
  },
}));

const fingerprint = 'A'.repeat(64);
const identity = {
  serviceSessionId: 'visit-id',
  participantToken: 'x'.repeat(40),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};
const account = { accountRevision: 9 } as TableGuestAccountDto;
const basket = { purchaseFingerprint: fingerprint, items: [{ id: 'basket-line' }] } as unknown as BasketDto;

function SubmissionProbe({ basketSnapshot, itemCount }: { basketSnapshot: BasketDto; itemCount: number }) {
  const visit = useTableGuestVisit();
  const result = useTableGuestRoundSubmission({
    basket: basketSnapshot,
    itemCount,
    syncBasket: jest.fn().mockResolvedValue(true),
    clearCart: jest.fn().mockResolvedValue(undefined),
  });
  return (
    <>
      <output>{`${visit.phase}:${result.pendingRound?.operationId ?? 'none'}:${result.lastRoundAcknowledgement ? 'ack' : 'pending'}`}</output>
      {result.error && <p role="alert">{result.error}</p>}
      <button type="button" onClick={() => void result.submit()} disabled={!result.canSubmit || result.isSubmitting}>
        {result.pendingRound ? 'Retry the same round' : 'Submit round'}
      </button>
    </>
  );
}

function renderSubmission(basketSnapshot = basket, itemCount = 1) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
        <TableGuestVisitProvider>
          <SubmissionProbe basketSnapshot={basketSnapshot} itemCount={itemCount} />
        </TableGuestVisitProvider>
      </TableGuestFeatureProvider>
    </I18nextProvider>,
  );
}

describe('useTableGuestRoundSubmission', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();
    jest.mocked(orderTypeConfigurationService.getEnabled).mockResolvedValue([OrderType.DineIn, OrderType.Takeaway]);
  });

  it('recovers a committed-but-unacknowledged round using the same operation before reading an empty basket', async () => {
    const requestOrder: string[] = [];
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
    sessionStorage.setItem(
      'rumi_table_guest_round_attempt_v1',
      JSON.stringify({
        serviceSessionId: 'visit-id',
        operationId: 'replay-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      }),
    );
    jest.mocked(tableGuestVisitService.createTableGuestRound).mockImplementation(async () => {
      requestOrder.push('round');
      return account;
    });
    jest.mocked(basketService.getBasket).mockImplementation(async () => {
      requestOrder.push('basket');
      return null;
    });

    renderSubmission({ ...basket, items: [] }, 0);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:replay-operation:pending'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry the same round' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same round' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:none:ack'));
    expect(requestOrder).toEqual(['round', 'basket']);
    expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledWith(identity, {
      operationId: 'replay-operation',
      expectedAccountRevision: 9,
      expectedBasketFingerprint: fingerprint,
    });
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
  });

  it('persists a round descriptor before send and retries the identical operation after remount', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'durable-operation'),
    });
    try {
      const requestOrder: string[] = [];
      let basketReads = 0;
      let roundCalls = 0;
      sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
      jest.mocked(tableGuestVisitService.getTableGuestAccount).mockImplementation(async () => {
        requestOrder.push('account');
        return account;
      });
      jest.mocked(basketService.getBasket).mockImplementation(async () => {
        requestOrder.push('basket');
        basketReads += 1;
        return basketReads === 1 ? basket : null;
      });
      jest.mocked(tableGuestVisitService.createTableGuestRound).mockImplementation(async () => {
        requestOrder.push('round');
        roundCalls += 1;
        if (roundCalls === 1) throw new TypeError('response lost');
        return account;
      });

      const firstMount = renderSubmission();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:none:pending'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Submit round' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Submit round' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('We could not confirm this round yet');

      const descriptorText = sessionStorage.getItem('rumi_table_guest_round_attempt_v1');
      expect(descriptorText).not.toBeNull();
      const descriptor = JSON.parse(descriptorText ?? '{}') as Record<string, unknown>;
      expect(descriptor).toEqual({
        serviceSessionId: 'visit-id',
        operationId: 'durable-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
      expect(descriptorText).not.toContain('basket-line');
      firstMount.unmount();

      renderSubmission({ ...basket, items: [] }, 0);
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:durable-operation:pending'));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Retry the same round' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Retry the same round' }));

      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:none:ack'));
      expect(requestOrder).toEqual(['account', 'basket', 'round', 'round', 'basket']);
      expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledTimes(2);
      expect(tableGuestVisitService.createTableGuestRound).toHaveBeenNthCalledWith(1, identity, {
        operationId: 'durable-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
      expect(tableGuestVisitService.createTableGuestRound).toHaveBeenNthCalledWith(2, identity, {
        operationId: 'durable-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
    } finally {
      if (originalDescriptor) Object.defineProperty(crypto, 'randomUUID', originalDescriptor);
      else Reflect.deleteProperty(crypto, 'randomUUID');
    }
  });

  it('refreshes instead of creating a new operation when the reviewed basket fingerprint is stale', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue(account);
    jest.mocked(basketService.getBasket).mockResolvedValue({
      ...basket,
      purchaseFingerprint: 'B'.repeat(64),
    });

    renderSubmission();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:none:pending'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit round' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Submit round' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The table account or basket changed');
    expect(tableGuestVisitService.createTableGuestRound).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
  });

  it('clears a stale revision attempt and keeps the basket for a new review', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
    sessionStorage.setItem(
      'rumi_table_guest_round_attempt_v1',
      JSON.stringify({
        serviceSessionId: 'visit-id',
        operationId: 'stale-operation',
        expectedAccountRevision: 4,
        expectedBasketFingerprint: fingerprint,
      }),
    );
    jest
      .mocked(tableGuestVisitService.createTableGuestRound)
      .mockRejectedValue(new ApiError(400, '', undefined, 'TableServiceSessionStale'));
    jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue(account);

    renderSubmission({ ...basket, items: [] }, 0);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:stale-operation:pending'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry the same round' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same round' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The table account or basket changed');
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
    expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledTimes(1);
    expect(basketService.getBasket).not.toHaveBeenCalled();
  });

  it('rechecks Dine-In before a fresh round and preserves the basket when it has closed', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
    jest
      .mocked(orderTypeConfigurationService.getEnabled)
      .mockResolvedValueOnce([OrderType.DineIn, OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.DineIn, OrderType.Takeaway])
      .mockResolvedValueOnce([OrderType.Takeaway]);

    renderSubmission();
    await waitFor(() => {
      expect(orderTypeConfigurationService.getEnabled).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Submit round' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit round' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dine-in is not available for this table visit right now.',
    );
    expect(orderTypeConfigurationService.getEnabled).toHaveBeenCalledTimes(3);
    expect(tableGuestVisitService.getTableGuestAccount).not.toHaveBeenCalled();
    expect(tableGuestVisitService.createTableGuestRound).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBeNull();
  });

  it('keeps the exact operation when Dine-In closes between preflight and the round response', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => 'availability-race-operation'),
    });
    try {
      const requestOrder: string[] = [];
      let availabilityReads = 0;
      sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
      jest.mocked(orderTypeConfigurationService.getEnabled).mockImplementation(async () => {
        availabilityReads += 1;
        requestOrder.push(`availability-${availabilityReads}`);
        return availabilityReads <= 3 ? [OrderType.DineIn, OrderType.Takeaway] : [OrderType.Takeaway];
      });
      jest.mocked(tableGuestVisitService.getTableGuestAccount).mockResolvedValue(account);
      jest.mocked(basketService.getBasket).mockResolvedValue(basket);
      jest.mocked(tableGuestVisitService.createTableGuestRound).mockImplementation(async (_identity, request) => {
        requestOrder.push(`round-${request.operationId}`);
        throw new ApiError(400, 'Unavailable', undefined, 'OrderTypeNotAvailable');
      });

      renderSubmission();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Submit round' })).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Submit round' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Dine-in is not available for this table visit right now.',
      );
      await waitFor(() => expect(availabilityReads).toBe(4));
      expect(screen.getByRole('status')).toHaveTextContent('active:availability-race-operation:pending');
      expect(screen.getByRole('button', { name: 'Retry the same round' })).toBeEnabled();
      expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(JSON.stringify(identity));
      expect(JSON.parse(sessionStorage.getItem('rumi_table_guest_round_attempt_v1') ?? '{}')).toEqual({
        serviceSessionId: 'visit-id',
        operationId: 'availability-race-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
      expect(tableGuestVisitService.getTableGuestAccount).toHaveBeenCalledTimes(1);
      expect(basketService.getBasket).toHaveBeenCalledTimes(1);

      const retryStart = requestOrder.length;
      fireEvent.click(screen.getByRole('button', { name: 'Retry the same round' }));
      await waitFor(() => expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(availabilityReads).toBe(5));
      expect(requestOrder.slice(retryStart)).toEqual(['round-availability-race-operation', 'availability-5']);
      expect(tableGuestVisitService.createTableGuestRound).toHaveBeenNthCalledWith(1, identity, {
        operationId: 'availability-race-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
      expect(tableGuestVisitService.createTableGuestRound).toHaveBeenNthCalledWith(2, identity, {
        operationId: 'availability-race-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      });
      expect(screen.getByRole('status')).toHaveTextContent('active:availability-race-operation:pending');
      expect(screen.getByRole('alert')).toHaveTextContent('Dine-in is not available for this table visit right now.');
    } finally {
      if (originalDescriptor) Object.defineProperty(crypto, 'randomUUID', originalDescriptor);
      else Reflect.deleteProperty(crypto, 'randomUUID');
    }
  });

  it('retries the exact pending operation even when current Dine-In availability is closed', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(identity));
    sessionStorage.setItem(
      'rumi_table_guest_round_attempt_v1',
      JSON.stringify({
        serviceSessionId: 'visit-id',
        operationId: 'same-pending-operation',
        expectedAccountRevision: 9,
        expectedBasketFingerprint: fingerprint,
      }),
    );
    jest.mocked(orderTypeConfigurationService.getEnabled).mockResolvedValue([OrderType.Takeaway]);
    jest.mocked(tableGuestVisitService.createTableGuestRound).mockResolvedValue(account);
    jest.mocked(basketService.getBasket).mockResolvedValue(null);

    renderSubmission({ ...basket, items: [] }, 0);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry the same round' })).toBeEnabled());
    const availabilityReads = jest.mocked(orderTypeConfigurationService.getEnabled).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Retry the same round' }));

    await waitFor(() => expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledTimes(1));
    expect(tableGuestVisitService.createTableGuestRound).toHaveBeenCalledWith(identity, {
      operationId: 'same-pending-operation',
      expectedAccountRevision: 9,
      expectedBasketFingerprint: fingerprint,
    });
    expect(orderTypeConfigurationService.getEnabled).toHaveBeenCalledTimes(availabilityReads);
  });
});
