import { saucesToDeselectForNoneOption } from './sauceGroup';

const rows = [
  { id: 'salsa', kind: 'sauce' as const },
  { id: 'mayo', kind: 'sauce' as const, isNoneOption: false },
  { id: 'none', kind: 'sauce' as const, isNoneOption: true },
  { id: 'other-none', kind: 'sauce' as const, isNoneOption: true },
  { id: 'onion', kind: 'ingredient' as const, isNoneOption: true },
  { id: 'legacy-ingredient' },
];

describe('saucesToDeselectForNoneOption', () => {
  it('clears every other selected sauce for a no-sauce answer, never non-sauce ingredients', () => {
    expect(
      saucesToDeselectForNoneOption(
        rows,
        'none',
        rows.map((row) => row.id),
      ),
    ).toEqual(['salsa', 'mayo', 'other-none']);
  });

  it('clears only selected no-sauce answers for a normal sauce, keeping ordinary multi-select', () => {
    expect(saucesToDeselectForNoneOption(rows, 'salsa', ['mayo', 'none', 'other-none', 'onion'])).toEqual([
      'none',
      'other-none',
    ]);
  });

  it.each(['salsa', 'mayo'])('keeps multi-select when the flag is absent or false (%s)', (target) => {
    expect(saucesToDeselectForNoneOption(rows, target, ['salsa', 'mayo'])).toEqual([]);
  });

  it('does not record removals for unselected rows and accepts a Set selection', () => {
    expect(saucesToDeselectForNoneOption(rows, 'none', new Set(['salsa']))).toEqual(['salsa']);
    expect(saucesToDeselectForNoneOption(rows, 'salsa', ['mayo'])).toEqual([]);
  });

  it.each(['unknown', 'onion', 'legacy-ingredient'])('ignores a missing or non-sauce target (%s)', (target) => {
    expect(saucesToDeselectForNoneOption(rows, target, ['salsa', 'none'])).toEqual([]);
  });
});
