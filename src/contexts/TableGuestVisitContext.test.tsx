import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError, apiClient } from '@/utils/apiClient';
import { getPublicTableGuestFeature } from '@/services/publicTableGuestFeatureService';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { loadTableGuestLocale } from '@/services/tableGuestLocaleService';
import { tableGuestVisitService } from '@/services/tableGuestVisitService';
import { useTableGuestVisit } from './TableGuestVisitContext';
import CheckoutTableGuestStateBridge from './CheckoutTableGuestStateBridge';
import { useCheckoutTableGuestState } from './CheckoutTableGuestStateContext';
import {
  createPendingTableGuestRound,
  createTableGuestVisitIdentity,
  renderWithTableGuestVisit,
} from '../test-utils/tableGuestVisitHarness';

jest.mock('@/services/tableGuestLocaleService', () => ({ loadTableGuestLocale: jest.fn() }));
jest.mock('@/services/publicTableGuestFeatureService', () => ({ getPublicTableGuestFeature: jest.fn() }));

function VisitProbe() {
  const { phase, pendingRound, getAccount, createRound, joinVisit, leaveAfterSafeDeparture } = useTableGuestVisit();
  const { retryTableGuestFeature } = useTableGuestFeature();
  return (
    <>
      <output>{`${phase}:${pendingRound?.operationId ?? 'none'}`}</output>
      <button type="button" onClick={() => void getAccount().catch(() => undefined)}>
        read account
      </button>
      <button
        type="button"
        onClick={() =>
          void createRound({
            operationId: 'operation-id',
            expectedAccountRevision: 3,
            expectedBasketFingerprint: 'B'.repeat(64),
          }).catch(() => undefined)
        }
      >
        submit round
      </button>
      <button type="button" onClick={retryTableGuestFeature}>
        retry feature
      </button>
      <button type="button" onClick={() => void joinVisit('qr-data', 'admission-code').catch(() => undefined)}>
        join next visit
      </button>
      <button type="button" onClick={leaveAfterSafeDeparture}>
        leave visit
      </button>
    </>
  );
}

function CheckoutProbe() {
  const state = useCheckoutTableGuestState();
  return <output aria-label="checkout-state">{`${state.phase}:${state.hasPendingRound ? 'pending' : 'none'}`}</output>;
}

describe('TableGuestVisitProvider', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();
    jest.mocked(loadTableGuestLocale).mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  it('holds dine-in recovery while saved visit state awaits the lazy provider', () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(createTableGuestVisitIdentity()));

    render(<VisitProbe />);

    expect(screen.getByText('loading:none')).toBeInTheDocument();
  });

  it('keeps the legacy guest path available when there is no saved visit', () => {
    render(<VisitProbe />);

    expect(screen.getByText('notJoined:none')).toBeInTheDocument();
  });

  it('restores only the tab-scoped visit and the non-content pending operation descriptor', async () => {
    sessionStorage.setItem('rumi_table_guest_visit_v1', JSON.stringify(createTableGuestVisitIdentity()));
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', JSON.stringify(createPendingTableGuestRound()));

    renderWithTableGuestVisit(<VisitProbe />, { tableGuestVisitsV1: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:operation-id'));
    expect(localStorage.getItem('rumi_table_guest_visit_v1')).toBeNull();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).not.toContain('specialInstructions');
  });

  it('preserves a saved participant and lost-response round when the rollout is turned off', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = JSON.stringify(createPendingTableGuestRound());
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    renderWithTableGuestVisit(<VisitProbe />, { tableGuestVisitsV1: false });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();
  });

  it('preserves a lost-response round across a transient locale failure and explicit retry', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = JSON.stringify(createPendingTableGuestRound());
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest.mocked(loadTableGuestLocale).mockRejectedValueOnce(new Error('temporary locale failure'));

    renderWithTableGuestVisit(<VisitProbe />, { tableGuestVisitsV1: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);

    fireEvent.click(screen.getByRole('button', { name: 'retry feature' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:operation-id'));
    expect(loadTableGuestLocale).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });

  it('preserves a lost-response round when the public rollout read recovers on retry', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = JSON.stringify(
      createPendingTableGuestRound({
        operationId: 'rollout-retry-operation',
        expectedAccountRevision: 4,
        expectedBasketFingerprint: 'D'.repeat(64),
      }),
    );
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: false, enabled: false })
      .mockResolvedValueOnce({ available: true, enabled: true });

    renderWithTableGuestVisit(<VisitProbe />, { readPublicTableGuestFeature: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:rollout-retry-operation'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    fireEvent.click(screen.getByRole('button', { name: 'retry feature' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:rollout-retry-operation'));
    expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });

  it('keeps the visit and pending operation after an account 404 races with feature disablement', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = JSON.stringify(createPendingTableGuestRound());
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: true, enabled: true })
      .mockResolvedValueOnce({ available: true, enabled: false });
    const accountRead = jest.spyOn(apiClient, 'get').mockRejectedValue(new ApiError(404, ''));

    renderWithTableGuestVisit(<VisitProbe />, { readPublicTableGuestFeature: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:operation-id'));
    fireEvent.click(screen.getByRole('button', { name: 'read account' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(accountRead).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'retry feature' }));
    await waitFor(() => expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });

  it('keeps a lost-response descriptor after a round 404 races with feature disablement', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = JSON.stringify(createPendingTableGuestRound());
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    jest
      .mocked(getPublicTableGuestFeature)
      .mockResolvedValueOnce({ available: true, enabled: true })
      .mockResolvedValueOnce({ available: true, enabled: false });
    const roundSubmission = jest.spyOn(apiClient, 'post').mockRejectedValue(new ApiError(404, ''));

    renderWithTableGuestVisit(<VisitProbe />, { readPublicTableGuestFeature: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('active:operation-id'));
    fireEvent.click(screen.getByRole('button', { name: 'submit round' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(roundSubmission).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'retry feature' }));
    await waitFor(() => expect(getPublicTableGuestFeature).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('unavailable:operation-id'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });

  it('marks an expired visit ended without resolving it against another party', async () => {
    const expiredVisit = JSON.stringify(
      createTableGuestVisitIdentity({
        expiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    );
    const rawAttempt = JSON.stringify(createPendingTableGuestRound());
    sessionStorage.setItem('rumi_table_guest_visit_v1', expiredVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    renderWithTableGuestVisit(<VisitProbe />, { tableGuestVisitsV1: true });

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ended:operation-id'));
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBeNull();
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBe('ended');
  });

  it('preserves a pending operation when the visit credential is malformed and blocks checkout and rejoin', async () => {
    const rawVisit = '{invalid';
    const rawAttempt = JSON.stringify(
      createPendingTableGuestRound({
        operationId: 'lost-response-operation',
        expectedBasketFingerprint: 'C'.repeat(64),
      }),
    );
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    const join = jest.spyOn(tableGuestVisitService, 'joinTableGuestVisit');

    renderWithTableGuestVisit(
      <CheckoutTableGuestStateBridge>
        <VisitProbe />
        <CheckoutProbe />
      </CheckoutTableGuestStateBridge>,
      { tableGuestVisitsV1: true },
    );

    await waitFor(() => expect(screen.getByText('storageUnavailable:lost-response-operation')).toBeInTheDocument());
    expect(screen.getByLabelText('checkout-state')).toHaveTextContent('storageUnavailable:pending');
    fireEvent.click(screen.getByRole('button', { name: 'join next visit' }));

    expect(join).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
    expect(sessionStorage.getItem('rumi_table_guest_visit_blocked_v1')).toBeNull();
  });

  it('blocks departure and new round writes when the pending-operation record cannot be read', async () => {
    const rawVisit = JSON.stringify(createTableGuestVisitIdentity());
    const rawAttempt = '{invalid';
    sessionStorage.setItem('rumi_table_guest_visit_v1', rawVisit);
    sessionStorage.setItem('rumi_table_guest_round_attempt_v1', rawAttempt);
    const join = jest.spyOn(tableGuestVisitService, 'joinTableGuestVisit');
    const createRound = jest.spyOn(tableGuestVisitService, 'createTableGuestRound');

    renderWithTableGuestVisit(
      <CheckoutTableGuestStateBridge>
        <VisitProbe />
        <CheckoutProbe />
      </CheckoutTableGuestStateBridge>,
      { tableGuestVisitsV1: true },
    );

    await waitFor(() => expect(screen.getByText('active:none')).toBeInTheDocument());
    expect(screen.getByLabelText('checkout-state')).toHaveTextContent('active:pending');
    fireEvent.click(screen.getByRole('button', { name: 'leave visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'join next visit' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit round' }));

    expect(join).not.toHaveBeenCalled();
    expect(createRound).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('rumi_table_guest_visit_v1')).toBe(rawVisit);
    expect(sessionStorage.getItem('rumi_table_guest_round_attempt_v1')).toBe(rawAttempt);
  });
});
