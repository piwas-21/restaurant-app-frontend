import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TFunction } from 'i18next';
import GuestCustomerInfoFields, {
  validateGuestCustomerInfoField,
  validateGuestCustomerInfoFields,
  type CustomerInfoField,
  type GuestCustomerInfoValue,
} from './GuestCustomerInfoFields';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

const t = ((_key: string, fallback?: string) => fallback ?? _key) as TFunction;

const handlers = {
  onChange: jest.fn(),
  onBlur: jest.fn(),
  setWantsRegister: jest.fn(),
  onRegisterChange: jest.fn(),
  onRegisterBlur: jest.fn(),
};

const renderFields = (
  visibleFields: ReadonlyArray<CustomerInfoField>,
  requiredFields: ReadonlyArray<CustomerInfoField>,
) =>
  render(
    <GuestCustomerInfoFields
      value={{ name: '', email: '', phone: '' }}
      errors={{ name: '', email: '', phone: '' }}
      visibleFields={visibleFields}
      requiredFields={requiredFields}
      showRegisterCta={false}
      wantsRegister={false}
      registerValue={{ password: '', confirmPassword: '' }}
      registerErrors={{ password: '', confirmPassword: '' }}
      {...handlers}
    />,
  );

beforeEach(() => jest.clearAllMocks());

describe('GuestCustomerInfoFields — per-field required rendering (D3)', () => {
  it('marks and requires only the effective-required fields (optional phone, e.g. Dine-In default config)', () => {
    renderFields(['name', 'email', 'phone'], ['name', 'email']);
    expect(screen.getByLabelText('Full Name *')).toBeRequired();
    expect(screen.getByLabelText('Email *')).toBeRequired();
    const phone = screen.getByLabelText('Phone');
    expect(phone).toHaveAttribute('type', 'tel');
    expect(phone).not.toBeRequired();
  });

  it('marks the phone when it is effectively required (Takeaway/Delivery floor or config)', () => {
    renderFields(['name', 'email', 'phone'], ['name', 'email', 'phone']);
    expect(screen.getByLabelText('Phone *')).toBeRequired();
  });

  it('renders only the visible fields (profile-narrowed set)', () => {
    renderFields(['phone'], ['phone']);
    expect(screen.queryByLabelText(/Full Name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Email/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Phone *')).toBeInTheDocument();
  });

  it('renders nothing when no fields are visible and the register CTA is suppressed', () => {
    const { container } = renderFields([], []);
    expect(container).toBeEmptyDOMElement();
  });

  it('emits change and blur per field', () => {
    renderFields(['name', 'email', 'phone'], ['name', 'email']);
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+41' } });
    expect(handlers.onChange).toHaveBeenCalledWith('phone', '+41');
    fireEvent.blur(screen.getByLabelText('Full Name *'));
    expect(handlers.onBlur).toHaveBeenCalledWith('name');
  });
});

describe('validateGuestCustomerInfoField — phoneRequired follows the merged rule', () => {
  it('rejects an empty phone only when effectively required', () => {
    expect(validateGuestCustomerInfoField('phone', '', t, { phoneRequired: true })).toBe('Phone is required');
    expect(validateGuestCustomerInfoField('phone', '', t, { phoneRequired: false })).toBe('');
    expect(validateGuestCustomerInfoField('phone', '', t)).toBe('');
  });

  it('still format-validates a filled optional phone', () => {
    expect(validateGuestCustomerInfoField('phone', 'abc', t, { phoneRequired: false })).not.toBe('');
    expect(validateGuestCustomerInfoField('phone', '+41 22 123 45 67', t, { phoneRequired: false })).toBe('');
  });

  it('keeps the locked-field schema rules intact', () => {
    expect(validateGuestCustomerInfoField('name', '', t)).not.toBe('');
    expect(validateGuestCustomerInfoField('email', 'not-an-email', t)).not.toBe('');
    expect(validateGuestCustomerInfoField('email', 'ada@example.com', t)).toBe('');
  });
});

describe('validateGuestCustomerInfoFields — the whole collected set at once', () => {
  const value = (over: Partial<GuestCustomerInfoValue> = {}): GuestCustomerInfoValue => ({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+41 22 123 45 67',
    ...over,
  });

  it('passes a complete set and reports no errors', () => {
    const result = validateGuestCustomerInfoFields(['name', 'email', 'phone'], value(), t, { phoneRequired: true });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual({ name: '', email: '', phone: '' });
  });

  it('collects every field error in one pass, not just the first', () => {
    const result = validateGuestCustomerInfoFields(['name', 'email'], value({ name: '', email: 'nope' }), t);
    expect(result.ok).toBe(false);
    expect(result.errors.name).not.toBe('');
    expect(result.errors.email).not.toBe('');
  });

  it('only judges the fields it was given — an unlisted bad field is not an error', () => {
    // Dine-In collects name+email; a blank phone must not block the commit there.
    const result = validateGuestCustomerInfoFields(['name', 'email'], value({ phone: '' }), t);
    expect(result.ok).toBe(true);
    expect(result.errors.phone).toBe('');
  });

  it('forwards phoneRequired to the per-field rule', () => {
    const fields: CustomerInfoField[] = ['name', 'email', 'phone'];
    expect(validateGuestCustomerInfoFields(fields, value({ phone: '' }), t, { phoneRequired: true }).ok).toBe(false);
    expect(validateGuestCustomerInfoFields(fields, value({ phone: '' }), t, { phoneRequired: false }).ok).toBe(true);
  });
});
