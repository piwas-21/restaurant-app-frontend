import type { OrderDto } from '@/types/order';
import { ApiError } from '@/utils/apiClient';
import {
  createStaffRound,
  lookupStaffRoundOperation,
  quoteStaffCounterOrder,
} from '@/services/staffCounterOrderService';
import { reconcileServerTableRound, reviewServerTableRound } from './serverTableRoundReview';

jest.mock('@/services/staffCounterOrderService', () => ({
  createStaffRound: jest.fn(),
  lookupStaffRoundOperation: jest.fn(),
  quoteStaffCounterOrder: jest.fn(),
}));

const mockQuote = quoteStaffCounterOrder as jest.MockedFunction<typeof quoteStaffCounterOrder>;
const mockCreate = createStaffRound as jest.MockedFunction<typeof createStaffRound>;
const mockLookup = lookupStaffRoundOperation as jest.MockedFunction<typeof lookupStaffRoundOperation>;
const quote = { id: 'quote-1', orderNumber: 'Q-1', total: 8 } as OrderDto;
const order = { id: 'order-1', orderNumber: 'R-1', total: 8 } as OrderDto;
const input = {
  tableId: 'T-QA/3',
  serviceSessionId: 'session-1',
  items: [{ product: { id: 'p1', name: 'Tea' }, quantity: 1, unitPrice: 8 }],
  notes: '',
  storedOperationId: 'operation-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockQuote.mockResolvedValue(quote);
  mockCreate.mockResolvedValue(order);
});

it('quotes first and creates the exact stable round operation', async () => {
  const calls: string[] = [];
  mockQuote.mockImplementation(async () => {
    calls.push('quote');
    return quote;
  });
  mockCreate.mockImplementation(async () => {
    calls.push('create');
    return order;
  });

  await expect(reviewServerTableRound(input)).resolves.toMatchObject({ status: 'committed', quote, order });
  expect(calls).toEqual(['quote', 'create']);
  expect(mockCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'DineIn',
      tableId: 'T-QA/3',
      serviceSessionId: 'session-1',
      paymentState: 'Unpaid',
      releaseToKitchen: true,
      clientOperationId: 'operation-1',
    }),
  );
});

it('maps a stale session refusal to stable translated copy', async () => {
  mockCreate.mockRejectedValue(
    new ApiError(200, 'Operation failed', ['The session is stale'], 'TableServiceSessionStale'),
  );
  await expect(reviewServerTableRound(input)).resolves.toMatchObject({
    status: 'refused',
    error: 'server.round.stale',
  });
});

it.each([
  ['TableServiceSessionAmbiguous', 'server.round.session_ambiguous'],
  ['TableServiceSessionRequired', 'server.round.session_required'],
  ['KitchenRoleRequired', 'server.round.kitchen_permission_required'],
  ['CashierRequired', 'server.round.cashier_required'],
  ['StaffOrderVersionConflict', 'server.round.version_conflict'],
])('maps %s to a translated remedy', async (errorCode, expected) => {
  mockCreate.mockRejectedValue(new ApiError(409, 'Backend-only English', [], errorCode));
  await expect(reviewServerTableRound(input)).resolves.toMatchObject({ status: 'refused', error: expected });
});

it('treats a lost create response as unknown and reconciles the same operation', async () => {
  mockCreate.mockRejectedValue(new TypeError('network lost'));
  await expect(reviewServerTableRound(input)).resolves.toMatchObject({ status: 'unknown', operationId: 'operation-1' });
  mockLookup.mockResolvedValue({ operationId: 'operation-1', status: 'Committed', order });
  await expect(reconcileServerTableRound('operation-1')).resolves.toMatchObject({ status: 'committed', order });
});
