import type { WorkingHoursDto } from '@/types/workingHours';
import { formatDayHours, formatTime, shiftsOf } from './workingHoursDisplay';

const day = (over: Partial<WorkingHoursDto> = {}): WorkingHoursDto => ({
  id: 'day-1',
  dayOfWeek: 5,
  openTime: '11:00:00',
  closeTime: '15:00:00',
  isActive: true,
  isClosed: false,
  ...over,
});

describe('formatTime', () => {
  it('renders a 24h time as 12h', () => {
    expect(formatTime('14:30:00')).toBe('2:30 PM');
    expect(formatTime('00:15:00')).toBe('12:15 AM');
    expect(formatTime('12:00:00')).toBe('12:00 PM');
  });

  /**
   * Classic and craft each carried a copy of this function and they had DRIFTED — classic's went
   * straight to `parseInt` and rendered "NaN:undefined AM" for a malformed value. Merging two
   * copies has to keep the more defensive one, or the merge ships a regression to the page that
   * had the guard, silently.
   */
  it('returns a malformed value unchanged rather than rendering NaN', () => {
    expect(formatTime('')).toBe('');
    expect(formatTime('not-a-time')).toBe('not-a-time');
    expect(formatTime('ab:cd')).toBe('ab:cd');
  });
});

describe('shiftsOf', () => {
  it('orders the windows by opening time, whatever order they arrive in', () => {
    const result = shiftsOf(
      day({
        shifts: [
          { openTime: '18:00:00', closeTime: '23:00:00' },
          { openTime: '11:00:00', closeTime: '15:00:00' },
        ],
      }),
    );

    expect(result.map((s) => s.openTime)).toEqual(['11:00:00', '18:00:00']);
  });

  it('falls back to the legacy pair when the API answers without shifts', () => {
    // An older backend, or this frontend deployed ahead of the API. Rendering nothing would be a
    // worse lie than rendering the single window the tenant actually has.
    expect(shiftsOf(day({ shifts: undefined }))).toEqual([{ openTime: '11:00:00', closeTime: '15:00:00' }]);
    expect(shiftsOf(day({ shifts: [] }))).toEqual([{ openTime: '11:00:00', closeTime: '15:00:00' }]);
  });

  it('does not mutate the array it was given', () => {
    const shifts = [
      { openTime: '18:00:00', closeTime: '23:00:00' },
      { openTime: '11:00:00', closeTime: '15:00:00' },
    ];

    shiftsOf(day({ shifts }));

    expect(shifts[0].openTime).toBe('18:00:00');
  });
});

describe('formatDayHours', () => {
  /** The whole point of G11 on the guest-facing side. */
  it('prints BOTH windows of a split shift', () => {
    expect(
      formatDayHours(
        day({
          shifts: [
            { openTime: '11:00:00', closeTime: '15:00:00' },
            { openTime: '18:00:00', closeTime: '23:00:00' },
          ],
        }),
        'Closed',
      ),
    ).toBe('11:00 AM - 3:00 PM, 6:00 PM - 11:00 PM');
  });

  it('prints a single window unchanged', () => {
    // The regression control: every tenant on the platform today is this shape.
    expect(formatDayHours(day({ shifts: [{ openTime: '11:00:00', closeTime: '23:00:00' }] }), 'Closed')).toBe(
      '11:00 AM - 11:00 PM',
    );
  });

  it('prints the closed label instead of any window', () => {
    expect(
      formatDayHours(
        day({
          isClosed: true,
          shifts: [{ openTime: '11:00:00', closeTime: '15:00:00' }],
        }),
        'Fermé',
      ),
    ).toBe('Fermé');
  });

  /**
   * Both home pages group CONSECUTIVE DAYS THAT SHARE THIS STRING. The grouping code was not
   * changed by G11 and must not need to be: two split days with the same windows have to produce
   * the same string, or a 7/7 split shift renders as seven separate lines.
   */
  it('gives two identical split days the same string, so they still group', () => {
    const shifts = [
      { openTime: '11:00:00', closeTime: '15:00:00' },
      { openTime: '18:00:00', closeTime: '23:00:00' },
    ];

    expect(formatDayHours(day({ dayOfWeek: 1, shifts }), 'Closed')).toBe(
      formatDayHours(day({ dayOfWeek: 2, shifts: [...shifts].reverse() }), 'Closed'),
    );
  });
});
