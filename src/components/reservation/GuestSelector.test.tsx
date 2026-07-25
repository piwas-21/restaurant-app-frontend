import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import GuestSelector from './GuestSelector';
import styles from './GuestSelector.module.css';

// t(key, fallback) → fallback, so labels render their English text.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
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
