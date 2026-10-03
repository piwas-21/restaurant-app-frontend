import {
  manualRefundFormSchema,
  resolutionApprovalFormSchema,
  tillRefundFormSchema,
} from './amendmentResolutionForm.schema';
import type { AmendmentResolutionContext } from './amendmentResolutionContext.schema';
import type { AmendmentResolutionQuote } from '@/types/amendmentResolution';

const ORDER = '00000000-0000-4000-8000-000000000001';
const AMENDMENT = '00000000-0000-4000-8000-000000000002';
const PAYMENT = '00000000-0000-4000-8000-000000000003';
const SECOND = '00000000-0000-4000-8000-000000000004';
const context: AmendmentResolutionContext = {
  orderId: ORDER,
  amendmentId: AMENDMENT,
  expectedOrderVersion: 7,
  expectedAccountRevision: null,
  currency: 'CHF',
  creditMinor: 333,
  manualRefundCandidates: [{ paymentId: PAYMENT, paymentMethod: 'Cash', availableMinor: 500 }],
};

describe('explicit manual refund selection form', () => {
  it('keeps a blank original tender unselected and permits an exact positive amount', () => {
    const schema = manualRefundFormSchema(context);
    expect(schema.safeParse({ payments: [{ paymentId: PAYMENT, amount: '' }] }).success).toBe(true);
    expect(schema.safeParse({ payments: [{ paymentId: PAYMENT, amount: '3.33' }] }).success).toBe(true);
    expect(schema.safeParse({ payments: [{ paymentId: PAYMENT, amount: '3,33' }] }).success).toBe(true);
  });
  it.each(['0', '-1', '3.34', '1.001', '1e2', 'Infinity', '9007199254740992'])(
    'refuses invalid or excessive selection %s',
    (amount) => {
      expect(manualRefundFormSchema(context).safeParse({ payments: [{ paymentId: PAYMENT, amount }] }).success).toBe(
        false,
      );
    },
  );
  it('refuses a changed payer, omitted tender or total above the food credit', () => {
    const schema = manualRefundFormSchema(context);
    expect(schema.safeParse({ payments: [{ paymentId: SECOND, amount: '1' }] }).success).toBe(false);
    expect(schema.safeParse({ payments: [] }).success).toBe(false);
    const two = manualRefundFormSchema({
      ...context,
      manualRefundCandidates: [
        ...context.manualRefundCandidates,
        { paymentId: SECOND, paymentMethod: 'CreditCard', availableMinor: 500 },
      ],
    });
    expect(
      two.safeParse({
        payments: [
          { paymentId: PAYMENT, amount: '2' },
          { paymentId: SECOND, amount: '2' },
        ],
      }).success,
    ).toBe(false);
  });
  it('accepts a smaller original payment only up to its remaining captured amount', () => {
    const schema = manualRefundFormSchema({
      ...context,
      manualRefundCandidates: [{ paymentId: PAYMENT, paymentMethod: 'Cash', availableMinor: 100 }],
    });
    expect(schema.safeParse({ payments: [{ paymentId: PAYMENT, amount: '1' }] }).success).toBe(true);
    expect(schema.safeParse({ payments: [{ paymentId: PAYMENT, amount: '1.01' }] }).success).toBe(false);
  });
});

describe('accepted operation till confirmation form', () => {
  const quote: AmendmentResolutionQuote = {
    orderId: ORDER,
    amendmentId: AMENDMENT,
    clientOperationId: SECOND,
    quoteHash: 'a'.repeat(64),
    expiresAt: '2030-01-01T00:00:00Z',
    currency: 'CHF',
    creditMinor: 333,
    refundMinor: 333,
    unpaidWaivedMinor: 0,
    refundLegs: [
      {
        paymentId: PAYMENT,
        paymentMethod: 'Cash',
        custody: 'ManualTill',
        amountMinor: 333,
        requiresTillConfirmation: true,
        scopes: [],
      },
    ],
  };
  const valid = { acknowledged: true, tillConfirmations: [{ paymentId: PAYMENT, tillReference: 'TILL-123/#' }] };
  it('requires explicit authorization before starting any refund', () => {
    expect(resolutionApprovalFormSchema.safeParse({ acknowledged: false }).success).toBe(false);
    expect(resolutionApprovalFormSchema.safeParse({ acknowledged: true }).success).toBe(true);
  });
  it('binds safe confirmation evidence to the exact original manual payer', () => {
    const schema = tillRefundFormSchema(quote);
    expect(schema.safeParse(valid).success).toBe(true);
    expect(
      schema.safeParse({ ...valid, tillConfirmations: [{ paymentId: SECOND, tillReference: 'TILL-123' }] }).success,
    ).toBe(false);
    expect(schema.safeParse({ ...valid, tillConfirmations: [] }).success).toBe(false);
    expect(schema.safeParse({ ...valid, acknowledged: false }).success).toBe(false);
  });
  it.each(['', 'Till refund', 'é-27', 'x'.repeat(81)])('rejects malformed till reference %s', (tillReference) => {
    expect(
      tillRefundFormSchema(quote).safeParse({ ...valid, tillConfirmations: [{ paymentId: PAYMENT, tillReference }] })
        .success,
    ).toBe(false);
  });
});
