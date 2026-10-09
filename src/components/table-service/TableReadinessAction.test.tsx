import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TableReadinessAction from './TableReadinessAction';
import { loadAccountPaymentLocale } from '@/services/accountPaymentLocaleService';
import { lookupTableReadiness, markTableReady } from '@/services/tableReadinessService';
import { persistPendingTableReadiness, readPendingTableReadiness } from '@/lib/pendingTableReadiness';
import type { PendingTableReadiness } from '@/types/tableReadiness';

jest.mock('@/services/tableReadinessService', () => ({ lookupTableReadiness: jest.fn(), markTableReady: jest.fn() }));
jest.mock('@/services/accountPaymentLocaleService', () => ({
  loadAccountPaymentLocale: jest.fn(() => Promise.resolve()),
}));
let mockEnabled = true;
let mockRole = 'Cashier';
let mockActorId: string | undefined = '11111111-1111-4111-8111-111111111111';
jest.mock('@/contexts/TenantFeaturesContext', () => ({
  useTenantFeatures: () => ({ tableVisitReadinessV1: mockEnabled }),
}));
jest.mock('@/components/AuthContext', () => ({ useOptionalAuth: () => ({ user: { role: mockRole } }) }));
jest.mock('@/hooks/accountPayments/useAccountPaymentActor', () => ({
  useAccountPaymentActor: () => ({
    actorId: mockActorId,
    status: mockActorId ? 'ready' : 'failed',
    retry: jest.fn(),
  }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
const lookup = jest.mocked(lookupTableReadiness);
const mark = jest.mocked(markTableReady);
const pending: PendingTableReadiness = {
  actorId: '11111111-1111-4111-8111-111111111111',
  actorRole: 'Cashier',
  tableId: '22222222-2222-4222-8222-222222222222',
  request: { operationId: '33333333-3333-4333-8333-333333333333', expectedReadinessVersion: 7 },
};
const props = {
  tableId: pending.tableId,
  readinessVersion: 7,
  canMarkReady: true,
  isStale: false,
  snapshot: {},
  refresh: jest.fn(() => Promise.resolve()),
};
beforeEach(() => {
  sessionStorage.clear();
  jest.clearAllMocks();
  mockEnabled = true;
  mockRole = 'Cashier';
  mockActorId = pending.actorId;
});
afterEach(() => jest.restoreAllMocks());

it('requires staff confirmation and preserves the original request before POST', async () => {
  jest.spyOn(crypto, 'randomUUID').mockReturnValue(pending.request.operationId);
  mark.mockResolvedValue({ kind: 'refused', code: 'TableReadinessOperationNotFound', terminal: false });
  render(<TableReadinessAction {...props} />);
  const button = await screen.findByRole('button', { name: 'server.floor.ready_action' });
  expect(mark).not.toHaveBeenCalled();
  fireEvent.click(button);
  await waitFor(() => expect(mark).toHaveBeenCalledWith(pending.tableId, pending.request));
  expect(readPendingTableReadiness(pending.actorId, pending.actorRole, pending.tableId)).toEqual({
    status: 'pending',
    value: pending,
  });
});

it('mounts old recovery with rollout off and a different current visit/version', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  mockEnabled = false;
  lookup.mockResolvedValue({ kind: 'refused', code: 'TableReadinessOperationNotFound', terminal: false });
  render(<TableReadinessAction {...props} readinessVersion={99} canMarkReady={false} />);
  await screen.findByRole('button', { name: 'accountPayments.readiness.check' });
  expect(lookup).toHaveBeenCalledWith(pending.tableId, pending.request);
  expect(screen.queryByRole('button', { name: 'server.floor.ready_action' })).not.toBeInTheDocument();
  expect(mark).not.toHaveBeenCalled();
});

it('disables fresh reset from a stale floor', async () => {
  render(<TableReadinessAction {...props} isStale />);
  expect(await screen.findByRole('button', { name: 'server.floor.ready_action' })).toBeDisabled();
  expect(mark).not.toHaveBeenCalled();
});

it('shows a terminal refusal through refresh and offers a new request only after a fresh snapshot', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  jest.spyOn(crypto, 'randomUUID').mockReturnValue('44444444-4444-4444-8444-444444444444');
  lookup.mockResolvedValue({ kind: 'refused', code: 'TableReadinessVersionStale', terminal: true });
  mark.mockResolvedValue({ kind: 'refused', code: 'TableReadinessVisitOpen', terminal: true });
  const view = render(<TableReadinessAction {...props} />);

  expect(await screen.findByText('accountPayments.readiness.errors.version_stale')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'accountPayments.readiness.refresh' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'server.floor.ready_action' })).toBeDisabled();
  expect(readPendingTableReadiness(pending.actorId, pending.actorRole, pending.tableId)).toEqual({ status: 'none' });

  view.rerender(
    <TableReadinessAction
      {...props}
      readinessVersion={8}
      snapshot={{ readinessState: 'NeedsReset', readinessVersion: 8 }}
    />,
  );
  const retry = await screen.findByRole('button', { name: 'server.floor.ready_action' });
  expect(retry).toBeEnabled();
  fireEvent.click(retry);
  await waitFor(() =>
    expect(mark).toHaveBeenCalledWith(pending.tableId, {
      operationId: '44444444-4444-4444-8444-444444444444',
      expectedReadinessVersion: 8,
    }),
  );
});

it('shows a clear disabled reason when the fresh table snapshot lacks a readiness version', async () => {
  render(<TableReadinessAction {...props} readinessVersion={null} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('accountPayments.readiness.version_unavailable');
  expect(screen.getByRole('button', { name: 'server.floor.ready_action' })).toBeDisabled();
  expect(mark).not.toHaveBeenCalled();
});

it('does not mount another staff role’s stored operation on role replacement', async () => {
  expect(persistPendingTableReadiness(pending)).toBe(true);
  lookup.mockResolvedValue({ kind: 'refused', code: 'TableReadinessOperationNotFound', terminal: false });
  const view = render(<TableReadinessAction {...props} />);
  await screen.findByRole('button', { name: 'accountPayments.readiness.check' });
  lookup.mockClear();
  mockRole = 'Server';
  view.rerender(<TableReadinessAction {...props} />);
  await screen.findByRole('button', { name: 'server.floor.ready_action' });
  expect(lookup).not.toHaveBeenCalled();
  expect(readPendingTableReadiness(pending.actorId, 'Cashier', pending.tableId).status).toBe('pending');
});

it('hides dormant rollout after storage check without loading another operation', async () => {
  mockEnabled = false;
  const view = render(<TableReadinessAction {...props} canMarkReady={false} />);
  await act(async () => Promise.resolve());
  expect(view.container).toBeEmptyDOMElement();
  expect(loadAccountPaymentLocale).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
  expect(mark).not.toHaveBeenCalled();
});

it('offers only identity retry after a profile failure with rollout off', async () => {
  mockEnabled = false;
  mockActorId = undefined;
  render(<TableReadinessAction {...props} />);
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'cashier.tables.retry' })).toBeEnabled();
  expect(mark).not.toHaveBeenCalled();
  expect(lookup).not.toHaveBeenCalled();
});
