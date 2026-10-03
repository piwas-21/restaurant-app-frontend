import type { AccountPaymentAllocation } from '@/types/accountPayments';
import type { GuestAccountPaymentAccount, GuestAccountPaymentOperation } from '@/types/guestAccountPayments';
import { webcrypto } from 'node:crypto';
import { TextEncoder as NodeTextEncoder } from 'node:util';
import {
  createGuestPaymentContribution,
  validateAccountResponse,
  validateCheckoutResponse,
  validatePaymentOperation,
  validateReceiptResponse,
} from './guestAccountPaymentResponse';
import {
  createGuestAccountPaymentDescriptor,
  withCheckoutAttempt,
  withQuotedOperation,
} from '@/services/guestAccountPaymentStorage';

const SESSION = '00000000-0000-4000-8000-000000000001';
const OPERATION = '00000000-0000-4000-8000-000000000010';
const ATTEMPT = '00000000-0000-4000-8000-000000000020';
const ORDER = '00000000-0000-4000-8000-000000000030';
const OTHER_ORDER = '00000000-0000-4000-8000-000000000031';
const ITEM = '00000000-0000-4000-8000-000000000040';

const allocation: AccountPaymentAllocation = {
  orderId: ORDER,
  orderItemId: null,
  startOrdinal: 1,
  unitCount: 1,
  minorPerUnit: 1250,
  amountMinor: 1250,
};

function operation(overrides: Partial<GuestAccountPaymentOperation> = {}): GuestAccountPaymentOperation {
  return {
    serviceSessionId: SESSION,
    operationId: OPERATION,
    state: 'Quoted',
    version: 1,
    expectedAccountRevision: 3,
    mode: 'Amount',
    paymentMethod: 'OnlinePayment',
    amountMinor: 1250,
    currency: 'CHF',
    quoteExpiresAt: '2030-01-01T00:10:00Z',
    reservedAt: null,
    reservationExpiresAt: null,
    equalSharePlanId: null,
    equalShareOrdinal: null,
    allocations: [allocation],
    ...overrides,
  };
}

async function descriptorFor(value = operation()) {
  const quote = createGuestAccountPaymentDescriptor(
    SESSION,
    OPERATION,
    {
      expectedAccountRevision: 3,
      mode: 'Amount',
      paymentMethod: 'OnlinePayment',
      amountMinor: 1250,
    },
    'a'.repeat(64),
  );
  return withQuotedOperation(quote, 1, await createGuestPaymentContribution(value));
}

describe('guest account payment response validation', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
    Object.defineProperty(globalThis, 'TextEncoder', { configurable: true, value: NodeTextEncoder });
  });
  it.each([
    ['wrong visit', { serviceSessionId: OTHER_ORDER }],
    ['wrong operation', { operationId: ATTEMPT }],
    ['wrong amount', { amountMinor: 1000, allocations: [{ ...allocation, minorPerUnit: 1000, amountMinor: 1000 }] }],
    ['wrong currency', { currency: 'EUR' }],
    ['wrong order scope', { allocations: [{ ...allocation, orderId: OTHER_ORDER }] }],
    ['unknown state', { state: 'Unknown' }],
  ])('rejects an operation with %s before it can replace saved evidence', async (_label, override) => {
    const original = operation();
    const descriptor = await descriptorFor(original);
    await expect(
      validatePaymentOperation(operation(override as Partial<GuestAccountPaymentOperation>), descriptor),
    ).rejects.toThrow();
  });

  it('rejects an oversized item allocation range before expanding it', async () => {
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION,
      OPERATION,
      {
        expectedAccountRevision: 3,
        mode: 'Items',
        paymentMethod: 'OnlinePayment',
        selectedUnits: [{ orderId: ORDER, orderItemId: ITEM, ordinal: 1 }],
      },
      'a'.repeat(64),
    );
    const hugeUnitCount = 1_000_000_000;
    const malformed = operation({
      mode: 'Items',
      amountMinor: hugeUnitCount,
      allocations: [
        {
          orderId: ORDER,
          orderItemId: ITEM,
          startOrdinal: 1,
          unitCount: hugeUnitCount,
          minorPerUnit: 1,
          amountMinor: hugeUnitCount,
        },
      ],
    });

    await expect(validatePaymentOperation(malformed, descriptor)).rejects.toThrow();
  });

  it('matches selected units and fingerprints allocations in deterministic ordinal order', async () => {
    const secondItem = '00000000-0000-4000-8000-000000000041';
    const firstItemAllocation = { ...allocation, orderItemId: ITEM, minorPerUnit: 500, amountMinor: 500 };
    const secondItemAllocation = {
      ...allocation,
      orderId: OTHER_ORDER,
      orderItemId: secondItem,
      minorPerUnit: 700,
      amountMinor: 700,
    };
    const ordered = operation({
      mode: 'Items',
      amountMinor: 1200,
      allocations: [firstItemAllocation, secondItemAllocation],
    });
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION,
      OPERATION,
      {
        expectedAccountRevision: 3,
        mode: 'Items',
        paymentMethod: 'OnlinePayment',
        selectedUnits: [
          { orderId: ORDER.toUpperCase(), orderItemId: ITEM.toUpperCase(), ordinal: 1 },
          { orderId: OTHER_ORDER.toUpperCase(), orderItemId: secondItem.toUpperCase(), ordinal: 1 },
        ],
      },
      'a'.repeat(64),
    );
    const reversed = { ...ordered, allocations: [...ordered.allocations].reverse() };
    const expectedContribution = await createGuestPaymentContribution(ordered);
    const quoted = withQuotedOperation(descriptor, 1, expectedContribution);
    const collationSpy = jest.spyOn(String.prototype, 'localeCompare').mockReturnValue(0);

    try {
      await expect(validatePaymentOperation(reversed, quoted)).resolves.toEqual(reversed);
      await expect(createGuestPaymentContribution(reversed)).resolves.toEqual(expectedContribution);
      expect(collationSpy).toHaveBeenCalled();
    } finally {
      collationSpy.mockRestore();
    }
  });

  it('checks a first quote against the exact reviewed account allocation', async () => {
    const descriptor = createGuestAccountPaymentDescriptor(
      SESSION,
      OPERATION,
      {
        expectedAccountRevision: 3,
        mode: 'Amount',
        paymentMethod: 'OnlinePayment',
        amountMinor: 1250,
      },
      'a'.repeat(64),
    );
    const account: GuestAccountPaymentAccount = {
      serviceSessionId: SESSION,
      status: 'Open',
      accountRevision: 3,
      currency: 'CHF',
      outstandingMinor: 5000,
      reservedMinor: 0,
      availableMinor: 5000,
      capturedAccountPaymentMinor: 0,
      outstandingAllocations: [{ ...allocation, minorPerUnit: 5000, amountMinor: 5000 }],
      availableAllocations: [{ ...allocation, minorPerUnit: 5000, amountMinor: 5000 }],
      activeEqualSharePlan: null,
      activeAttempts: [],
      limits: {
        maximumSelectedUnits: 20,
        maximumEqualShares: 8,
        online: { currency: 'CHF', minimumAmountMinor: 100, maximumAmountMinor: 5000 },
      },
    };
    const wrongScope = operation({ allocations: [{ ...allocation, orderId: OTHER_ORDER }] });
    await expect(validatePaymentOperation(wrongScope, descriptor, ['Quoted'], account)).rejects.toThrow();
  });

  it.each([
    ['attempt', { attemptId: OTHER_ORDER }],
    ['operation', { operationId: OTHER_ORDER }],
    ['amount', { amountMinor: 1000 }],
    ['currency', { currency: 'EUR' }],
    ['state', { state: 'Quoted' }],
  ])('rejects checkout status with mismatched %s evidence', async (_label, override) => {
    const descriptor = withCheckoutAttempt(await descriptorFor(), ATTEMPT);
    const checkout = Object.assign(
      {
        attemptId: ATTEMPT,
        operationId: OPERATION,
        state: 'Starting',
        version: 1,
        amountMinor: 1250,
        currency: 'CHF',
        expiresAt: '2030-01-01T00:10:00Z',
        checkoutUrl: null,
        reconciliationRequired: false,
        receivedMinor: 0,
        refundedMinor: 0,
      },
      override,
    );
    expect(() => validateCheckoutResponse(checkout, descriptor)).toThrow();
  });

  it.each([
    ['Captured with no received funds', { state: 'Captured', receivedMinor: 0 }],
    ['Released with received funds', { state: 'Released', receivedMinor: 1 }],
    ['Failed with received funds', { state: 'Failed', receivedMinor: 1 }],
  ])('rejects checkout status with inconsistent clean terminal evidence: %s', async (_label, override) => {
    const descriptor = withCheckoutAttempt(await descriptorFor(), ATTEMPT);
    const checkout = Object.assign(
      {
        attemptId: ATTEMPT,
        operationId: OPERATION,
        state: 'Starting',
        version: 2,
        amountMinor: 1250,
        currency: 'CHF',
        expiresAt: '2030-01-01T00:10:00Z',
        checkoutUrl: null,
        reconciliationRequired: false,
        receivedMinor: 0,
        refundedMinor: 0,
      },
      override,
    );

    expect(() => validateCheckoutResponse(checkout, descriptor)).toThrow();
  });

  it('accepts canonical checkout terminal evidence and keeps reconciliation-held evidence nonterminal', async () => {
    const descriptor = withCheckoutAttempt(await descriptorFor(), ATTEMPT);
    const checkout = {
      attemptId: ATTEMPT,
      operationId: OPERATION,
      state: 'Captured',
      version: 2,
      amountMinor: 1250,
      currency: 'CHF',
      expiresAt: '2030-01-01T00:10:00Z',
      checkoutUrl: null,
      reconciliationRequired: false,
      receivedMinor: 1250,
      refundedMinor: 250,
    };

    expect(validateCheckoutResponse(checkout, descriptor)).toEqual(checkout);
    expect(
      validateCheckoutResponse({ ...checkout, state: 'Released', receivedMinor: 0, refundedMinor: 0 }, descriptor)
        .state,
    ).toBe('Released');
    expect(
      validateCheckoutResponse({ ...checkout, state: 'Failed', receivedMinor: 0, refundedMinor: 0 }, descriptor).state,
    ).toBe('Failed');
    expect(
      validateCheckoutResponse(
        { ...checkout, state: 'Captured', receivedMinor: 0, refundedMinor: 0, reconciliationRequired: true },
        descriptor,
      ).reconciliationRequired,
    ).toBe(true);
  });

  it('rejects a receipt for a different attempt or amount', async () => {
    const descriptor = await descriptorFor();
    const receipt = {
      attemptId: ATTEMPT,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Captured',
      receivedMinor: 1250,
      refundedMinor: 0,
      reconciliationRequired: false,
      completedAt: '2030-01-01T00:10:00Z',
    };
    expect(() => validateReceiptResponse(receipt, OTHER_ORDER, descriptor)).toThrow();
    expect(() => validateReceiptResponse({ ...receipt, amountMinor: 1000 }, ATTEMPT, descriptor)).toThrow();
  });

  it.each([
    ['Captured with no received funds', { state: 'Captured', receivedMinor: 0 }],
    ['Released with received funds', { state: 'Released', receivedMinor: 1 }],
    ['Failed with received funds', { state: 'Failed', receivedMinor: 1 }],
  ])('rejects receipt with inconsistent clean terminal evidence: %s', async (_label, override) => {
    const descriptor = await descriptorFor();
    const receipt = Object.assign(
      {
        attemptId: ATTEMPT,
        amountMinor: 1250,
        currency: 'CHF',
        state: 'Captured',
        receivedMinor: 1250,
        refundedMinor: 0,
        reconciliationRequired: false,
        completedAt: '2030-01-01T00:10:00Z',
      },
      override,
    );

    expect(() => validateReceiptResponse(receipt, ATTEMPT, descriptor)).toThrow();
  });

  it('accepts canonical receipt evidence including partial refunds and leaves held evidence unresolved', async () => {
    const descriptor = await descriptorFor();
    const receipt = {
      attemptId: ATTEMPT,
      amountMinor: 1250,
      currency: 'CHF',
      state: 'Captured',
      receivedMinor: 1250,
      refundedMinor: 250,
      reconciliationRequired: false,
      completedAt: '2030-01-01T00:10:00Z',
    };

    expect(validateReceiptResponse(receipt, ATTEMPT, descriptor)).toEqual(receipt);
    expect(
      validateReceiptResponse(
        { ...receipt, state: 'Released', receivedMinor: 0, refundedMinor: 0 },
        ATTEMPT,
        descriptor,
      ).state,
    ).toBe('Released');
    expect(
      validateReceiptResponse({ ...receipt, state: 'Failed', receivedMinor: 0, refundedMinor: 0 }, ATTEMPT, descriptor)
        .state,
    ).toBe('Failed');
    expect(
      validateReceiptResponse(
        { ...receipt, state: 'Captured', receivedMinor: 0, refundedMinor: 0, reconciliationRequired: true },
        ATTEMPT,
        descriptor,
      ).reconciliationRequired,
    ).toBe(true);
  });

  it('rejects account payloads from another visit or with inconsistent allocation totals', () => {
    const account = {
      serviceSessionId: SESSION,
      status: 'Open',
      accountRevision: 3,
      currency: 'CHF',
      outstandingMinor: 5,
      reservedMinor: 0,
      availableMinor: 5,
      capturedAccountPaymentMinor: 0,
      outstandingAllocations: [{ ...allocation, minorPerUnit: 5, amountMinor: 5 }],
      availableAllocations: [{ ...allocation, minorPerUnit: 5, amountMinor: 5 }],
      activeEqualSharePlan: null,
      activeAttempts: [],
      limits: { maximumSelectedUnits: 20, maximumEqualShares: 8, online: null },
    };
    expect(() => validateAccountResponse(account, OTHER_ORDER)).toThrow();
    expect(() => validateAccountResponse({ ...account, availableMinor: 4 }, SESSION)).toThrow();
    expect(() =>
      validateAccountResponse(
        {
          ...account,
          activeAttempts: [{ operationId: OPERATION, state: 'Unknown' }],
        },
        SESSION,
      ),
    ).toThrow();
  });
});
