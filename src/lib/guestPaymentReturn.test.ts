import { parseGuestPaymentReturn, stripGuestPaymentReturnFromUrl } from './guestPaymentReturn';

describe('guest payment return hints', () => {
  it('accepts a UUID attempt hint but never treats canceled as settlement evidence', () => {
    expect(parseGuestPaymentReturn('?paymentAttempt=00000000-0000-4000-8000-000000000001&canceled=1')).toEqual({
      attemptId: '00000000-0000-4000-8000-000000000001',
      canceled: true,
      present: true,
    });
    expect(parseGuestPaymentReturn('?paymentAttempt=cs_test_unsafe&canceled=0')).toEqual({
      attemptId: null,
      canceled: false,
      present: true,
    });
  });

  it('strips checkout hints before preserving locale path, unrelated query and hash', () => {
    window.history.replaceState(
      {},
      '',
      '/fr/table-account?paymentAttempt=00000000-0000-4000-8000-000000000001&canceled=1&view=items#payments',
    );

    expect(stripGuestPaymentReturnFromUrl()).toMatchObject({ present: true, canceled: true });
    expect(window.location.pathname).toBe('/fr/table-account');
    expect(window.location.search).toBe('?view=items');
    expect(window.location.hash).toBe('#payments');
  });
});
