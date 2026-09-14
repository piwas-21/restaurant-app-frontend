import { orderStatusPresentation } from './orderStatusPresentation';

const t = (key: string) => `translated:${key}`;

describe('orderStatusPresentation', () => {
  it.each([
    ['Ready', 'translated:order_status_ready', 'success', 'ready'],
    ['pendingapproval', 'translated:order_status_pending_approval', 'warning', 'completed'],
    ['OutForDelivery', 'translated:order_status_in_transit', 'info', 'completed'],
    ['in transit', 'translated:order_status_in_transit', 'info', 'completed'],
    ['In Progress', 'translated:order_status_in_progress', 'info', 'completed'],
  ] as const)('normalizes %s through the canonical order mapping', (status, label, tone, fill) => {
    expect(orderStatusPresentation(status, t)).toEqual({ label, tone, fill });
  });

  it('keeps an unknown server value visible with neutral styling', () => {
    expect(orderStatusPresentation('FutureStatus', t)).toEqual({
      label: 'FutureStatus',
      tone: 'neutral',
      fill: 'completed',
    });
  });

  it('does not invent a label for an absent status', () => {
    expect(orderStatusPresentation(null, t)).toEqual({ label: '', tone: 'neutral', fill: 'completed' });
  });
});
