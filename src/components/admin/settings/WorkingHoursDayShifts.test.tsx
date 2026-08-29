import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkingHoursDayShifts from './WorkingHoursDayShifts';
import { MAX_SHIFTS_PER_DAY, asEditableShift } from './workingHoursDay';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOpts?: unknown, maybeOpts?: unknown) => {
      const opts = (typeof fallbackOrOpts === 'object' ? fallbackOrOpts : maybeOpts) as
        Record<string, unknown> | undefined;
      const fallback =
        typeof fallbackOrOpts === 'string' ? fallbackOrOpts : ((opts?.defaultValue as string | undefined) ?? key);
      return fallback.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts?.[name] ?? ''));
    },
  }),
}));

const lunch = asEditableShift({ openTime: '11:00:00', closeTime: '15:00:00' });
const dinner = asEditableShift({ openTime: '18:00:00', closeTime: '23:00:00' });

const renderCell = (shifts = [lunch], disabled = false) => {
  const onChange = jest.fn();
  render(<WorkingHoursDayShifts shifts={shifts} dayName="Friday" disabled={disabled} onChange={onChange} />);
  return onChange;
};

/**
 * A model that can hold a lunch and a dinner is worth nothing if the only editor can enter one
 * pair, so this cell is the half of G11 the restaurant actually touches. ADD and REMOVE are both
 * asserted here: a fixed second pair would only move the limit from one window to two.
 */
describe('WorkingHoursDayShifts', () => {
  it('renders one pair of inputs per window', () => {
    renderCell([lunch, dinner]);

    expect(screen.getByLabelText('Open time, window 1, Friday')).toHaveValue('11:00');
    expect(screen.getByLabelText('Close time, window 1, Friday')).toHaveValue('15:00');
    expect(screen.getByLabelText('Open time, window 2, Friday')).toHaveValue('18:00');
    expect(screen.getByLabelText('Close time, window 2, Friday')).toHaveValue('23:00');
  });

  it('adds a window', () => {
    const onChange = renderCell([lunch]);

    fireEvent.click(screen.getByLabelText('Add an opening window on Friday'));

    // Seeded from the previous window's CLOSING time, not 00:00: a default that started before the
    // existing window ended would be refused by the overlap rule the moment it was saved.
    expect(onChange).toHaveBeenCalledWith([
      lunch,
      expect.objectContaining({ openTime: '15:00:00', closeTime: '23:00:00' }),
    ]);
  });

  it('removes a window', () => {
    const onChange = renderCell([lunch, dinner]);

    fireEvent.click(screen.getByLabelText('Remove window 1, Friday'));

    expect(onChange).toHaveBeenCalledWith([dinner]);
  });

  it('offers no remove button when there is only one window', () => {
    // An open day needs at least one window — the API answers 400 for an empty list — so the UI
    // must not be able to enter that state at all.
    renderCell([lunch]);

    expect(screen.queryByLabelText('Remove window 1, Friday')).not.toBeInTheDocument();
  });

  it('stops offering to add at the limit the API enforces', () => {
    const many = Array.from({ length: MAX_SHIFTS_PER_DAY }, (_, i) =>
      asEditableShift({
        openTime: `${String(8 + i * 2).padStart(2, '0')}:00:00`,
        closeTime: `${String(9 + i * 2).padStart(2, '0')}:00:00`,
      }),
    );

    renderCell(many);

    expect(screen.queryByLabelText('Add an opening window on Friday')).not.toBeInTheDocument();
  });

  it('sends a changed time back with seconds, the way the API stores them', () => {
    const onChange = renderCell([lunch, dinner]);

    fireEvent.change(screen.getByLabelText('Open time, window 2, Friday'), { target: { value: '19:30' } });

    expect(onChange).toHaveBeenCalledWith([lunch, { ...dinner, openTime: '19:30:00' }]);
  });

  /**
   * The reason a window carries a client-only `uid` at all. Keyed by array INDEX, removing the
   * first of two windows makes React reuse the removed row's DOM node for the survivor, so a
   * focused input and its caret jump to a window the admin was not editing.
   */
  it('gives every window a stable identity that survives a removal', () => {
    const onChange = renderCell([lunch, dinner]);

    fireEvent.click(screen.getByLabelText('Remove window 1, Friday'));

    expect(onChange).toHaveBeenCalledWith([dinner]);
    expect(dinner.uid).not.toBe(lunch.uid);
  });

  it('disables every control on a closed day', () => {
    renderCell([lunch, dinner], true);

    expect(screen.getByLabelText('Open time, window 1, Friday')).toBeDisabled();
    expect(screen.getByLabelText('Remove window 2, Friday')).toBeDisabled();
    expect(screen.getByLabelText('Add an opening window on Friday')).toBeDisabled();
  });
});
