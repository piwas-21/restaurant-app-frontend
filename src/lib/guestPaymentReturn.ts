const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface GuestPaymentReturnHint {
  readonly attemptId: string | null;
  readonly canceled: boolean;
  readonly present: boolean;
}

export function parseGuestPaymentReturn(search: string): GuestPaymentReturnHint {
  const params = new URLSearchParams(search);
  const rawAttemptId = params.get('paymentAttempt');
  const canceled = params.get('canceled') === '1';
  const present = params.has('paymentAttempt') || params.has('canceled');
  return {
    attemptId: rawAttemptId && UUID.test(rawAttemptId) ? rawAttemptId : null,
    canceled,
    present,
  };
}

/** Remove provider-return hints before the route is rendered to analytics consumers. */
export function stripGuestPaymentReturnFromUrl(): GuestPaymentReturnHint {
  if (typeof window === 'undefined') return { attemptId: null, canceled: false, present: false };
  const hint = parseGuestPaymentReturn(window.location.search);
  if (!hint.present) return hint;
  const url = new URL(window.location.href);
  url.searchParams.delete('paymentAttempt');
  url.searchParams.delete('canceled');
  const query = url.searchParams.toString();
  const querySuffix = query ? `?${query}` : '';
  const nextUrl = `${url.pathname}${querySuffix}${url.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
  return hint;
}
