import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomerDetailsForm from './CustomerDetailsForm';
import { DEFAULT_FORM_FIELD_RULES, type FormFieldRules } from '@/types/formFieldConfig';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

let mockRules: FormFieldRules = DEFAULT_FORM_FIELD_RULES.reservation;
jest.mock('@/hooks/useCustomerFormFields', () => ({
  useCustomerFormFields: () => ({ rules: mockRules, loading: false }),
}));

const handlers = {
  onNameChange: jest.fn(),
  onEmailChange: jest.fn(),
  onPhoneChange: jest.fn(),
  onSpecialRequestsChange: jest.fn(),
};

const renderForm = () =>
  render(<CustomerDetailsForm customerName="" customerEmail="" customerPhone="" specialRequests="" {...handlers} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockRules = DEFAULT_FORM_FIELD_RULES.reservation;
});

describe('CustomerDetailsForm', () => {
  it('gives every control an accessible name via a real FormField label', () => {
    renderForm();
    expect(screen.getByLabelText('Your Name *')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Your Email *')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Your Phone')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText('Special requests').tagName).toBe('TEXTAREA');
  });

  it('leaves the phone optional by default (no HTML required, no * marker)', () => {
    renderForm();
    expect(screen.getByLabelText('Your Phone')).not.toBeRequired();
    expect(screen.getByLabelText('Special requests')).not.toBeRequired();
    // Locked name/email stay required.
    expect(screen.getByLabelText('Your Name *')).toBeRequired();
    expect(screen.getByLabelText('Your Email *')).toBeRequired();
  });

  it('marks and enforces a config-required phone', () => {
    mockRules = {
      ...DEFAULT_FORM_FIELD_RULES.reservation,
      customerPhone: { isVisible: true, isRequired: true },
    };
    renderForm();
    expect(screen.getByLabelText('Your Phone *')).toBeRequired();
  });

  it('forwards typed values through each change handler', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Your Name *'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Your Email *'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Your Phone'), { target: { value: '+41' } });
    fireEvent.change(screen.getByLabelText('Special requests'), { target: { value: 'window' } });

    expect(handlers.onNameChange).toHaveBeenCalledWith('Ada');
    expect(handlers.onEmailChange).toHaveBeenCalledWith('ada@example.com');
    expect(handlers.onPhoneChange).toHaveBeenCalledWith('+41');
    expect(handlers.onSpecialRequestsChange).toHaveBeenCalledWith('window');
  });

  it('omits fields the config hides', () => {
    mockRules = {
      ...DEFAULT_FORM_FIELD_RULES.reservation,
      customerPhone: { isVisible: false, isRequired: false },
      specialRequests: { isVisible: false, isRequired: false },
    };
    renderForm();
    expect(screen.queryByLabelText(/Your Phone/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Special requests/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Your Name *')).toBeInTheDocument();
  });
});
