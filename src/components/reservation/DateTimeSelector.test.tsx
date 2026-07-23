import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
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
