import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import DeliveryAddressSection from './DeliveryAddressSection';
import type { useDeliveryAddress } from '@/hooks/checkout/useDeliveryAddress';
import { DEFAULT_FORM_FIELD_RULES, FORM_KEYS, type FormFieldRules } from '@/types/formFieldConfig';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

type Address = ReturnType<typeof useDeliveryAddress>;

const DEFAULTS = DEFAULT_FORM_FIELD_RULES[FORM_KEYS.deliveryAddress];

function makeAddress(overrides: Partial<Address> = {}): Address {
  return {
    street: '',
    city: '',
    postalCode: '',
    country: 'Switzerland',
    additionalInfo: '',
    fieldRules: DEFAULTS,
    addressError: '',
    listError: null,
    isLoggedIn: false,
    savedAddresses: [],
    selectedAddressId: null,
    showNewAddressForm: true,
    saveThisAddress: false,
    loadingAddresses: false,
    savingAddress: false,
    setStreet: jest.fn(),
    setCity: jest.fn(),
    setPostalCode: jest.fn(),
    setCountry: jest.fn(),
    setAdditionalInfo: jest.fn(),
    setAddressError: jest.fn(),
    setSaveThisAddress: jest.fn(),
    selectSavedAddress: jest.fn(),
    showAddNewAddress: jest.fn(),
    validate: jest.fn(),
    persistIfRequested: jest.fn(),
    trimmed: jest.fn(),
    ...overrides,
  };
}

const rulesWith = (overrides: FormFieldRules): FormFieldRules => ({ ...DEFAULTS, ...overrides });

describe('DeliveryAddressSection — config-driven country/additionalInfo (D3)', () => {
  it('renders both configurable fields as optional under the default rules (today’s behaviour)', () => {
    render(<DeliveryAddressSection address={makeAddress()} />);
    expect(screen.getByLabelText('Country')).not.toBeRequired();
    expect(screen.getByLabelText('Additional Information (optional)')).not.toBeRequired();
    // Locked fields keep their required markers.
    expect(screen.getByLabelText('Street Address *')).toBeInTheDocument();
  });

  it('hides a config-hidden country and additionalInfo', () => {
    const fieldRules = rulesWith({
      country: { isVisible: false, isRequired: false },
      additionalInfo: { isVisible: false, isRequired: false },
    });
    render(<DeliveryAddressSection address={makeAddress({ fieldRules })} />);
    expect(screen.queryByLabelText(/Country/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Additional Information/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Street Address *')).toBeInTheDocument();
  });

  it('marks and requires a config-required country, surfacing the shared error inline', () => {
    const fieldRules = rulesWith({ country: { isVisible: true, isRequired: true } });
    render(
      <DeliveryAddressSection
        address={makeAddress({
          fieldRules,
          country: '',
          street: 'Rue du Rhône 1',
          city: 'Genève',
          postalCode: '1204',
          addressError: 'This field is required',
        })}
      />,
    );
    // FormField nests the error inside the <label>, so the accessible name
    // is "Country * <error>" — match on the prefix.
    expect(screen.getByLabelText(/^Country \*/)).toBeRequired();
    // Error text renders once (inline on the country field, no duplicate paragraph).
    expect(screen.getAllByText('This field is required')).toHaveLength(1);
  });

  it('marks a config-required additionalInfo (no "(optional)" hint)', () => {
    const fieldRules = rulesWith({ additionalInfo: { isVisible: true, isRequired: true } });
    render(<DeliveryAddressSection address={makeAddress({ fieldRules })} />);
    expect(screen.getByLabelText('Additional Information *')).toBeRequired();
    expect(screen.queryByLabelText(/optional/)).not.toBeInTheDocument();
  });

  it('falls back to the shared error paragraph when no rendered field is empty', () => {
    render(
      <DeliveryAddressSection
        address={makeAddress({
          street: 'Rue du Rhône 1',
          city: 'Genève',
          postalCode: '12',
          addressError: 'Postal code is invalid',
        })}
      />,
    );
    expect(screen.getByText('Postal code is invalid')).toBeInTheDocument();
  });

  it('clears the shared error when typing into the configurable fields', () => {
    const address = makeAddress();
    render(<DeliveryAddressSection address={address} />);
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'France' } });
    expect(address.setCountry).toHaveBeenCalledWith('France');
    expect(address.setAddressError).toHaveBeenCalledWith('');
    fireEvent.change(screen.getByLabelText('Additional Information (optional)'), { target: { value: 'Floor 2' } });
    expect(address.setAdditionalInfo).toHaveBeenCalledWith('Floor 2');
  });
});

/**
 * `addressError` is a VALIDATION slot: `errorOn` hands it to whichever of street/postcode/city is
 * empty. An address-book outage routed through it therefore appeared as three simultaneous field
 * errors on inputs the customer had not touched, and any keystroke cleared it. `listError` is the
 * page-level slot for that fact.
 */
describe('DeliveryAddressSection — a failed address list is not a field error', () => {
  it('renders listError once, not once per empty required field', () => {
    render(
      <DeliveryAddressSection
        address={makeAddress({ listError: 'Could not load your saved addresses.', isLoggedIn: true })}
      />,
    );

    expect(screen.getAllByText('Could not load your saved addresses.')).toHaveLength(1);
  });

  it('does not paint the untouched inputs as invalid', () => {
    render(
      <DeliveryAddressSection
        address={makeAddress({ listError: 'Could not load your saved addresses.', isLoggedIn: true })}
      />,
    );

    // `errorOn` marks a field by giving `FormField` an error; none should have one here.
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  it('still routes a genuine validation error to its field', () => {
    render(<DeliveryAddressSection address={makeAddress({ addressError: 'This field is required' })} />);

    expect(screen.getAllByText('This field is required').length).toBeGreaterThan(0);
  });
});
