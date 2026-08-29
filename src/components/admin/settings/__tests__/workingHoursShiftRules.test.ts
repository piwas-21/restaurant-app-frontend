import { MAX_SHIFTS_PER_DAY, findShiftProblem } from '../workingHoursDay';

/**
 * The client half of the rule the API enforces. It exists so an admin sees the problem before the
 * save round-trips, so it has to agree with the server on WHICH problem comes first — an admin who
 * is told a different first problem than the API would report is being sent round a loop.
 */
describe('findShiftProblem', () => {
  const lunch = { openTime: '11:00:00', closeTime: '15:00:00' };
  const dinner = { openTime: '18:00:00', closeTime: '23:00:00' };

  it('accepts a split shift', () => {
    expect(findShiftProblem([lunch, dinner])).toBeNull();
  });

  it('accepts the windows in either order — the rule sorts before it judges', () => {
    expect(findShiftProblem([dinner, lunch])).toBeNull();
  });

  it('rejects an empty list', () => {
    // The caller only reaches this for a day that is NOT marked closed.
    expect(findShiftProblem([])).toEqual({ kind: 'empty' });
  });

  it('rejects a window that closes before it opens', () => {
    expect(findShiftProblem([{ openTime: '15:00:00', closeTime: '11:00:00' }])).toEqual({
      kind: 'order',
      shift: { openTime: '15:00:00', closeTime: '11:00:00' },
    });
  });

  it('rejects a zero-length window', () => {
    // Never what anyone meant, and it would report the shop as open for exactly one instant.
    expect(findShiftProblem([{ openTime: '15:00:00', closeTime: '15:00:00' }])?.kind).toBe('order');
  });

  it('rejects overlapping windows', () => {
    const early = { openTime: '11:00:00', closeTime: '16:00:00' };
    const late = { openTime: '15:00:00', closeTime: '23:00:00' };

    expect(findShiftProblem([early, late])).toEqual({ kind: 'overlap', earlier: early, later: late });
  });

  /**
   * The negative control for the overlap rule. 15:00-15:00 is a handover, not an overlap, and a
   * rule written with `<=` instead of `<` would refuse a legal split — a loosening/tightening error
   * that no other test here would catch.
   */
  it('accepts windows that merely touch', () => {
    expect(
      findShiftProblem([
        { openTime: '11:00:00', closeTime: '15:00:00' },
        { openTime: '15:00:00', closeTime: '23:00:00' },
      ]),
    ).toBeNull();
  });

  it('rejects more windows than the API accepts', () => {
    const many = Array.from({ length: MAX_SHIFTS_PER_DAY + 1 }, (_, i) => ({
      openTime: `${String(8 + i * 2).padStart(2, '0')}:00:00`,
      closeTime: `${String(9 + i * 2).padStart(2, '0')}:00:00`,
    }));

    expect(findShiftProblem(many)).toEqual({ kind: 'tooMany', count: MAX_SHIFTS_PER_DAY + 1 });
  });

  it('does not mutate the array it was given', () => {
    const shifts = [dinner, lunch];
    findShiftProblem(shifts);
    expect(shifts[0]).toBe(dinner);
  });
});
