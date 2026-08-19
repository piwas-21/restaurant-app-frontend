/**
 * @jest-environment ./jest-environments/timezone.js
 * @jest-environment-options {"timezone": "America/Los_Angeles"}
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DateTimeSelector from './DateTimeSelector';
import styles from './DateTimeSelector.module.css';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k, i18n: { language: 'en' } }),
}));

describe('DateTimeSelector accessibility', () => {
  it('labels the custom date input and the time select (fixes axe `label` + `select-name`)', () => {
    render(
      <DateTimeSelector
        selectedDate=""
        selectedTime=""
        onDateChange={() => {}}
        onTimeChange={() => {}}
        today="2026-08-19"
        timeSlotOptions={[
          { time: '18:00', available: true },
          { time: '19:00', available: true },
        ]}
        styles={styles}
      />,
    );
    expect(screen.getByLabelText('Or pick a date:')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Or select time:').tagName).toBe('SELECT');
  });
});

describe('DateTimeSelector unavailable slots', () => {
  it('renders unavailable slots disabled (chip + select option) instead of hiding them', () => {
    render(
      <DateTimeSelector
        selectedDate=""
        selectedTime=""
        onDateChange={() => {}}
        onTimeChange={() => {}}
        today="2026-08-19"
        timeSlotOptions={[
          { time: '18:00', available: true },
          { time: '19:00', available: false },
        ]}
        styles={styles}
      />,
    );

    const availableChip = screen.getByRole('button', { name: '18:00' });
    const unavailableChip = screen.getByRole('button', { name: '19:00' });
    expect(availableChip).toBeEnabled();
    expect(unavailableChip).toBeDisabled();

    expect(screen.getByRole('option', { name: '18:00' })).toBeEnabled();
    expect(screen.getByRole('option', { name: '19:00' })).toBeDisabled();
  });
});

/**
 * @see frontend #517 — the buttons were labelled with the device's LOCAL day and sent its UTC one.
 * The component itself no longer touches a clock — a day is a string here — so the assertions are
 * zone-free by construction. The suite still runs WEST of UTC (see the docblock), because the one
 * thing that does render through `Intl` is the weekday label, and west of UTC a UTC-anchored day
 * formatted on the local clock names the day before.
 */
describe('the device is deliberately NOT on UTC', () => {
  it('renders a UTC-anchored day as the day BEFORE on its own clock', () => {
    // The premise of the weekday assertion below. On a UTC host it is false and that assertion
    // passes against a label formatted on the local clock.
    expect(new Date('2026-08-19T00:00:00Z').toLocaleDateString('en-CA')).toBe('2026-08-18');
  });
});

describe('DateTimeSelector — the day a guest taps is the day the form sends', () => {
  // The device's clock is pinned far away from the day under test, so an implementation that
  // quietly reads `new Date()` instead of the prop cannot coincide with the right answer.
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setTimeout', 'setInterval', 'queueMicrotask', 'nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-03-01T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  const render14 = (today: string) => {
    const onDateChange = jest.fn();
    render(
      <DateTimeSelector
        selectedDate=""
        selectedTime=""
        onDateChange={onDateChange}
        onTimeChange={() => {}}
        today={today}
        timeSlotOptions={[{ time: '18:00', available: true }]}
        styles={styles}
      />,
    );
    return onDateChange;
  };

  it("starts at the restaurant's today and runs 14 days from it", () => {
    render14('2026-08-19');

    const days = screen.getAllByRole('button').filter((b) => b.className.includes('dateButton'));
    expect(days).toHaveLength(14);
    expect(days[0].textContent).toContain('19');
    // 2026-08-19 is a Wednesday. Formatted on this device's own clock the same instant is Tuesday
    // the 18th, so this asserts the label is read in UTC like the day it belongs to.
    expect(days[0].textContent).toContain('Wed');
    // Across a month end, which naive `+ i` arithmetic on a day-of-month gets wrong. The whole
    // label, not `toContain('1')` — that matches 1, 11, 14, 19, 21 and 31 alike.
    expect(days[13].textContent).toBe('1Tue');
  });

  it('sends exactly the day it printed on the button', () => {
    const onDateChange = render14('2026-08-19');

    const days = screen.getAllByRole('button').filter((b) => b.className.includes('dateButton'));
    // The first button is labelled 19; before the fix, in a zone east of UTC after local midnight,
    // it sent the 18th.
    fireEvent.click(days[0]);
    expect(onDateChange).toHaveBeenLastCalledWith('2026-08-19');

    fireEvent.click(days[13]);
    expect(onDateChange).toHaveBeenLastCalledWith('2026-09-01');
  });

  it("floors the free-text date picker at the restaurant's today", () => {
    render14('2026-08-19');

    expect(screen.getByLabelText('Or pick a date:')).toHaveAttribute('min', '2026-08-19');
  });

  it('offers no day at all until the restaurant has named one', () => {
    // Better than a guessed day: every day it could offer here is the device's, and the server is
    // the only thing that knows whether that is the same day.
    render14('');

    expect(screen.queryAllByRole('button').filter((b) => b.className.includes('dateButton'))).toHaveLength(0);
    expect(screen.getByLabelText('Or pick a date:')).toHaveAttribute('min', '');
  });
});

describe('DateTimeSelector — the other two ways a guest names a day or a time', () => {
  const setup = () => {
    const onDateChange = jest.fn();
    const onTimeChange = jest.fn();
    render(
      <DateTimeSelector
        selectedDate=""
        selectedTime=""
        onDateChange={onDateChange}
        onTimeChange={onTimeChange}
        today="2026-08-19"
        timeSlotOptions={[
          { time: '18:00', available: true },
          { time: '19:00', available: false },
        ]}
        styles={styles}
      />,
    );
    return { onDateChange, onTimeChange };
  };

  it('passes a typed date through untouched', () => {
    // The free-text picker hands up a `YYYY-MM-DD` string; nothing may re-read it through a Date.
    const { onDateChange } = setup();

    fireEvent.change(screen.getByLabelText('Or pick a date:'), { target: { value: '2026-08-27' } });

    expect(onDateChange).toHaveBeenCalledWith('2026-08-27');
  });

  it('reports the time a guest taps, and refuses the one that is gone', () => {
    const { onTimeChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: '18:00' }));
    expect(onTimeChange).toHaveBeenCalledWith('18:00');

    fireEvent.click(screen.getByRole('button', { name: '19:00' }));
    expect(onTimeChange).toHaveBeenCalledTimes(1);
  });

  it('reports the time a guest selects from the list', () => {
    const { onTimeChange } = setup();

    fireEvent.change(screen.getByLabelText('Or select time:'), { target: { value: '18:00' } });

    expect(onTimeChange).toHaveBeenCalledWith('18:00');
  });
});

describe('DateTimeSelector — what it shows as chosen, and what it falls back to', () => {
  it('marks the chosen day and the chosen time', () => {
    render(
      <DateTimeSelector
        selectedDate="2026-08-20"
        selectedTime="18:00"
        onDateChange={() => {}}
        onTimeChange={() => {}}
        today="2026-08-19"
        timeSlotOptions={[{ time: '18:00', available: true }]}
        styles={styles}
      />,
    );

    const chosenDay = screen
      .getAllByRole('button')
      .find((b) => b.className.includes('dateButton') && b.textContent?.includes('20'));
    expect(chosenDay!.className).toContain('selected');
    expect(screen.getByRole('button', { name: '18:00' }).className).toContain('selected');
  });

  it('offers its own times, disabled, when the day has produced none yet', () => {
    // No `timeSlotOptions` at all is the pre-selection state; the select must not invite a choice
    // it cannot honour.
    render(
      <DateTimeSelector
        selectedDate=""
        selectedTime=""
        onDateChange={() => {}}
        onTimeChange={() => {}}
        today="2026-08-19"
        styles={styles}
      />,
    );

    expect(screen.getByRole('button', { name: '11:00' })).toBeInTheDocument();
    expect(screen.getByLabelText('Or select time:')).toBeDisabled();
  });

  it('disables every time chip while the day is still loading', () => {
    render(
      <DateTimeSelector
        selectedDate="2026-08-19"
        selectedTime=""
        onDateChange={() => {}}
        onTimeChange={() => {}}
        loading
        today="2026-08-19"
        timeSlotOptions={[{ time: '18:00', available: true }]}
        styles={styles}
      />,
    );

    expect(screen.getByRole('button', { name: '18:00' })).toBeDisabled();
  });
});
