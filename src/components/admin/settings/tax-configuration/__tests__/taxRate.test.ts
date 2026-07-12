import { validateRateInput } from '../taxRate';

describe('validateRateInput', () => {
  it('treats empty input as a valid 0 (clear-to-reset)', () => {
    expect(validateRateInput('')).toEqual({ valid: true, rate: 0 });
  });

  it.each([
    ['8.1', 8.1],
    ['100', 100],
    ['0', 0],
    ['0.5', 0.5],
    ['.5', 0.5],
    ['8.', 8],
    ['19.6', 19.6],
  ])('accepts the plain decimal %p', (input, expected) => {
    expect(validateRateInput(input)).toEqual({ valid: true, rate: expected });
  });

  // The reason this issue exists: Number.parseFloat silently accepted these.
  it.each(['8.1abc', '0x10', '1e2', '8.1.1', '.', '  8', '8 ', '+8', 'abc'])(
    'rejects junk / hex / scientific / multi-dot input %p',
    (input) => {
      expect(validateRateInput(input)).toEqual({ valid: false });
    },
  );

  it.each(['101', '100.1', '-1', '-0.5'])('rejects out-of-range input %p', (input) => {
    expect(validateRateInput(input)).toEqual({ valid: false });
  });

  it('does not return a rate for invalid input (leaves the stored value untouched)', () => {
    expect(validateRateInput('8.1abc').rate).toBeUndefined();
  });
});
