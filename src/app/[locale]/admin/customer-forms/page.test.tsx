import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import CustomerFormsPage from './page';
import type { FormFieldsDto } from '@/types/formFieldConfig';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

const forms: FormFieldsDto[] = [
  {
    formKey: 'reservation',
    fields: [
      { fieldKey: 'customerName', isVisible: true, isRequired: true, isLocked: true, displayOrder: 0 },
      { fieldKey: 'customerPhone', isVisible: true, isRequired: false, isLocked: false, displayOrder: 2 },
    ],
  },
  {
    formKey: 'delivery_address',
    fields: [{ fieldKey: 'country', isVisible: true, isRequired: false, isLocked: false, displayOrder: 3 }],
  },
];

const mockAdmin = {
  forms,
  loading: false,
  savingFormKey: null as string | null,
  setFieldState: jest.fn(),
  isDirty: jest.fn().mockReturnValue(false),
  saveForm: jest.fn(),
};

jest.mock('@/hooks/admin/useCustomerFormsAdmin', () => ({
  ...jest.requireActual('@/hooks/admin/useCustomerFormsAdmin'),
  useCustomerFormsAdmin: () => mockAdmin,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockAdmin.loading = false;
  mockAdmin.savingFormKey = null;
  mockAdmin.isDirty.mockReturnValue(false);
});

describe('CustomerFormsPage', () => {
  it('shows a loading state while the configuration loads', () => {
    mockAdmin.loading = true;
    render(<CustomerFormsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Reservation form')).not.toBeInTheDocument();
  });

  it('renders one section per form with translated titles', () => {
    render(<CustomerFormsPage />);
    expect(screen.getByText('Reservation form')).toBeInTheDocument();
    expect(screen.getByText('Delivery address')).toBeInTheDocument();
  });

  it('renders locked fields as Required + disabled with a lock hint', () => {
    render(<CustomerFormsPage />);
    const lockedSelect = screen.getByLabelText<HTMLSelectElement>('Name');
    expect(lockedSelect).toBeDisabled();
    expect(lockedSelect.value).toBe('required');
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText(/Always visible and required/)).toBeInTheDocument();
  });

  it('lets a configurable field cycle through the 3 states', () => {
    render(<CustomerFormsPage />);
    const phoneSelect = screen.getByLabelText<HTMLSelectElement>('Phone');
    expect(phoneSelect).toBeEnabled();
    expect(phoneSelect.value).toBe('optional');

    fireEvent.change(phoneSelect, { target: { value: 'required' } });
    expect(mockAdmin.setFieldState).toHaveBeenCalledWith('reservation', 'customerPhone', 'required');
  });

  it('disables Save until the form is dirty, then saves that form', () => {
    mockAdmin.isDirty.mockImplementation((key: string) => key === 'reservation');
    render(<CustomerFormsPage />);

    const [reservationSave, deliverySave] = screen.getAllByRole('button', { name: 'Save Changes' });
    expect(reservationSave).toBeEnabled();
    expect(deliverySave).toBeDisabled();

    fireEvent.click(reservationSave);
    expect(mockAdmin.saveForm).toHaveBeenCalledWith('reservation');
  });

  it('disables every control while a save is in flight', () => {
    mockAdmin.isDirty.mockReturnValue(true);
    mockAdmin.savingFormKey = 'reservation';
    render(<CustomerFormsPage />);

    expect(screen.getByLabelText('Phone')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });
});
