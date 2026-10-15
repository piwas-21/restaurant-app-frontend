/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import { formatBusinessDate, formatBusinessTime } from './formatBusinessDate';

describe('formatBusinessDate', () => {
  it('preserves the tenant calendar date when the browser timezone would show the prior day', () => {
    const midnightUtc = new Date('2026-10-15T00:00:00.000Z');
    expect(midnightUtc.toLocaleDateString('en-US')).toBe('10/14/2026');
    expect(formatBusinessDate('2026-10-15', 'en-US')).toBe('Oct 15, 2026');
  });

  it('rejects malformed and impossible date-only values', () => {
    expect(formatBusinessDate('2026-2-15', 'en')).toBeNull();
    expect(formatBusinessDate('2026-02-30', 'en')).toBeNull();
    expect(formatBusinessDate(undefined, 'en')).toBeNull();
  });

  it('uses the supplied tenant timezone for an order time, not the browser timezone', () => {
    const orderDate = '2026-10-03T12:00:00.000Z';
    expect(new Date(orderDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })).toMatch(/05:00/);
    expect(formatBusinessTime(orderDate, 'en-US', 'Europe/Zurich')).toMatch(/02:00/);
    expect(formatBusinessTime(orderDate, 'en-US')).toBeNull();
  });
});
