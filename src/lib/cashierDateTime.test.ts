import { formatCashierDateTime } from './cashierDateTime';

describe('formatCashierDateTime', () => {
  it('uses the server timezone for a DST-boundary instant', () => {
    const instant = new Date('2026-03-29T00:30:00.000Z');
    const expected = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Zurich',
    }).format(instant);

    expect(formatCashierDateTime(instant.toISOString(), 'en-US', 'Europe/Zurich', 'short', 'Unknown')).toBe(expected);
  });

  it('does not use a malformed server timezone or date as a device value', () => {
    expect(formatCashierDateTime('not-a-date', 'en-US', 'Europe/Zurich', 'short', 'Unknown')).toBe('Unknown');
    expect(formatCashierDateTime('2026-03-29T00:30:00.000Z', 'en-US', 'Not/AZone', 'short', 'Unknown')).toBe('Unknown');
  });
});
