import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import GuestSelector from './GuestSelector';
import styles from './GuestSelector.module.css';
import { RESERVATION_GUEST_CAP } from '@/lib/reservationLimits';

// t(key, fallback, vars) → the fallback with `{{vars}}` filled, so the cap sentence renders its
// number instead of a placeholder — the assertion below is about the NUMBER.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, vars?: Record<string, unknown>) =>
      Object.entries(vars ?? {}).reduce<string>(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        f ?? _k,
      ),
  }),
}));

describe('GuestSelector accessibility', () => {
  it('associates the custom guest input with its label (fixes axe `label`)', () => {
    render(<GuestSelector numberOfGuests={2} onGuestsChange={() => {}} styles={styles} />);
    // getByLabelText resolves a control only when it has an accessible name —
    // i.e. the htmlFor/id association is in place.
    const input = screen.getByLabelText('Or custom:');
    expect(input).toHaveAttribute('type', 'number');
  });
});

/**
 * The cap (frontend #557). The picker offered `max="50"` while every reservation DTO carries
 * `[Range(1, 20)]`, so a guest who picked 21+ filled the whole form and met a `400` from model
 * validation — in the `ValidationProblemDetails` shape, which the client did not read.
 */
describe('GuestSelector — the party-size cap', () => {
  it('defaults to the backend cap when no caller supplies one', () => {
    render(<GuestSelector numberOfGuests={2} onGuestsChange={() => {}} styles={styles} />);

    expect(screen.getByLabelText('Or custom:')).toHaveAttribute('max', String(RESERVATION_GUEST_CAP));
  });

  it('reports the preset a guest presses', () => {
    const onGuestsChange = jest.fn();
    render(<GuestSelector numberOfGuests={2} onGuestsChange={onGuestsChange} maxGuests={6} styles={styles} />);

    fireEvent.click(screen.getByRole('button', { name: '5' }));

    expect(onGuestsChange).toHaveBeenCalledWith(5);
  });

  it('offers no preset above the cap', () => {
    render(<GuestSelector numberOfGuests={2} onGuestsChange={() => {}} maxGuests={4} styles={styles} />);

    expect(screen.getByRole('button', { name: '4' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '8' })).not.toBeInTheDocument();
  });

  // `min`/`max` on a number input are ADVISORY — they mark the field invalid and accept the value
  // anyway, and this form does not submit through native validation. Clamping is what actually
  // keeps an impossible party off the wire. `50` is what the picker itself used to offer, and what
  // #557 was reported for; `''` is a cleared field, which used to fall to `|| 1` and now clamps.
  it.each([
    ['a party over the cap', '50', 6],
    ['a cleared field', '', 1],
    ['a negative party', '-3', 1],
  ])('clamps %s into the allowed range', (_case, typed, expected) => {
    const onGuestsChange = jest.fn();
    render(<GuestSelector numberOfGuests={2} onGuestsChange={onGuestsChange} maxGuests={6} styles={styles} />);

    fireEvent.change(screen.getByLabelText('Or custom:'), { target: { value: typed } });

    expect(onGuestsChange).toHaveBeenLastCalledWith(expected);
  });

  it('says so, with the number, once the cap is reached — before anything is submitted', () => {
    render(<GuestSelector numberOfGuests={6} onGuestsChange={() => {}} maxGuests={6} styles={styles} />);

    // `<output>` carries the status role implicitly, so a screen reader is told too.
    expect(screen.getByRole('status')).toHaveTextContent(
      'We can seat at most 6 guests in one booking. Please contact us for a larger party.',
    );
  });

  it('stays quiet below the cap', () => {
    render(<GuestSelector numberOfGuests={5} onGuestsChange={() => {}} maxGuests={6} styles={styles} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('still says so for a party already OVER the cap — a booking made before the table shrank', () => {
    render(<GuestSelector numberOfGuests={12} onGuestsChange={() => {}} maxGuests={4} styles={styles} />);

    expect(screen.getByRole('status')).toHaveTextContent('We can seat at most 4 guests');
  });
});
