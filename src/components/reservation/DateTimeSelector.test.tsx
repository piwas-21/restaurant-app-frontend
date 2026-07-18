import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DateTimeSelector from './DateTimeSelector';

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
        availableTimeSlots={['18:00', '19:00']}
      />,
    );
    expect(screen.getByLabelText('Or pick a date:')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Or select time:').tagName).toBe('SELECT');
  });
});
