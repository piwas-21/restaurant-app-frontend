import { shouldQueuePendingReview } from './cashierOrderReviewQueue';

describe('shouldQueuePendingReview', () => {
  const flows = new Map([
    ['Takeaway', { flow: 'acknowledge' as const, reviewWindowMinutes: 2 }],
    ['Delivery', { flow: 'direct' as const, reviewWindowMinutes: 2 }],
  ]);

  it('queues only the acknowledge flow once configuration is loaded', () => {
    expect(shouldQueuePendingReview('Takeaway', false, flows)).toBe(true);
    expect(shouldQueuePendingReview('Delivery', false, flows)).toBe(false);
    expect(shouldQueuePendingReview('Unknown', false, flows)).toBe(false);
  });

  it('holds an arriving order until a loading configuration can classify it', () => {
    expect(shouldQueuePendingReview('Delivery', true, null)).toBe(true);
  });
});
