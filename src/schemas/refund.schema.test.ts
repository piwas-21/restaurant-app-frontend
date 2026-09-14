import { refundSchema } from './refund.schema';

const valid = {
  paymentId: 'payment-1',
  reason: 'Customer request',
  refundType: 'full' as const,
  refundAmount: '40',
};

describe('refundSchema', () => {
  it('requires a selected payment', () => {
    const result = refundSchema(40).safeParse({ ...valid, paymentId: '' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ['paymentId'] });
  });

  it('mirrors the backend reason minimum', () => {
    const result = refundSchema(40).safeParse({ ...valid, reason: 'Nope' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ['reason'] });
  });

  it('requires a positive partial amount', () => {
    const result = refundSchema(40).safeParse({ ...valid, refundType: 'partial', refundAmount: '' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ['refundAmount'] });
  });

  it('caps a partial amount at the selected payment amount', () => {
    const result = refundSchema(40).safeParse({ ...valid, refundType: 'partial', refundAmount: '40.01' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]).toMatchObject({ path: ['refundAmount'] });
  });

  it('accepts a full refund at the selected payment amount', () => {
    expect(refundSchema(40).safeParse(valid).success).toBe(true);
  });
});
