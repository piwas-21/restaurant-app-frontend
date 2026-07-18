import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CustomerDetailsForm from './CustomerDetailsForm';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

describe('CustomerDetailsForm accessibility', () => {
  it('gives every control an accessible name via aria-label (fixes axe `label`)', () => {
    render(
      <CustomerDetailsForm
        customerName=""
        customerEmail=""
        customerPhone=""
        specialRequests=""
        onNameChange={() => {}}
        onEmailChange={() => {}}
        onPhoneChange={() => {}}
        onSpecialRequestsChange={() => {}}
      />,
    );
    // getByLabelText resolves via aria-label here (no htmlFor); a match proves
    // each control has an accessible name, not just a placeholder.
    expect(screen.getByLabelText('Your Name')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Your Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Your Phone')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Special requests').tagName).toBe('TEXTAREA');
  });
});
