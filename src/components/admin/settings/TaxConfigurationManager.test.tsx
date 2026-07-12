import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TaxConfigurationManager from './TaxConfigurationManager';
import { adminTaxConfigurationService } from '@/services/adminTaxConfigurationService';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import { OrderType } from '@/types/order';

// Stub react-i18next so t(key, fallback) renders the fallback string (the
// components use the t('key', 'Default') pattern) without an i18next provider.
// ConfirmationModal calls t('yes')/t('cancel') with no fallback, so those
// render the raw key.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

// notistack: a stable enqueueSnackbar mock the assertions can inspect. The
// factory only reads mockEnqueueSnackbar when useSnackbar() runs at render time
// (initialised by then), and jest permits the `mock`-prefixed out-of-scope ref.
const mockEnqueueSnackbar = jest.fn();
jest.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

// The hook fetches on mount and mutates through the service; mock it so the
// tests drive the success / error / CRUD branches deterministically.
jest.mock('@/services/adminTaxConfigurationService', () => ({
  adminTaxConfigurationService: {
    getAllTaxConfigurations: jest.fn(),
    createTaxConfiguration: jest.fn(),
    updateTaxConfiguration: jest.fn(),
    deleteTaxConfiguration: jest.fn(),
  },
}));

const mockGetAll = adminTaxConfigurationService.getAllTaxConfigurations as jest.MockedFunction<
  typeof adminTaxConfigurationService.getAllTaxConfigurations
>;
const mockCreate = adminTaxConfigurationService.createTaxConfiguration as jest.MockedFunction<
  typeof adminTaxConfigurationService.createTaxConfiguration
>;
const mockUpdate = adminTaxConfigurationService.updateTaxConfiguration as jest.MockedFunction<
  typeof adminTaxConfigurationService.updateTaxConfiguration
>;
const mockDelete = adminTaxConfigurationService.deleteTaxConfiguration as jest.MockedFunction<
  typeof adminTaxConfigurationService.deleteTaxConfiguration
>;

const sampleConfigs: TaxConfiguration[] = [
  {
    id: 'tax-1',
    name: 'VAT',
    rate: 8.1,
    isEnabled: true,
    description: 'Standard VAT',
    applicableOrderTypes: [OrderType.DineIn, OrderType.Takeaway],
  },
  {
    id: 'tax-2',
    name: 'Reduced',
    rate: 2.5,
    isEnabled: false,
    description: 'Reduced rate',
    applicableOrderTypes: [],
  },
];

const ERROR_MSG = 'Rate must be a valid number between 0 and 100';

// Opens the create form and returns the rate <input>.
async function openCreateForm() {
  fireEvent.click(await screen.findByRole('button', { name: 'Add Tax Configuration' }));
  return screen.getByPlaceholderText('e.g., 8.00');
}

describe('TaxConfigurationManager', () => {
  beforeEach(() => {
    mockEnqueueSnackbar.mockReset();
    mockGetAll.mockReset();
    mockCreate.mockReset();
    mockUpdate.mockReset();
    mockDelete.mockReset();
    mockGetAll.mockResolvedValue(sampleConfigs);
    mockCreate.mockResolvedValue(sampleConfigs[0]);
    mockUpdate.mockResolvedValue(sampleConfigs[0]);
    mockDelete.mockResolvedValue(undefined);
  });

  it('fetches on mount and renders the returned tax configurations', async () => {
    render(<TaxConfigurationManager />);
    expect(await screen.findByText('VAT')).toBeInTheDocument();
    expect(screen.getByText('Reduced')).toBeInTheDocument();
    // status badges + a localized order-type badge from getOrderTypeLabel
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('Dine-In')).toBeInTheDocument();
    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast when the mount fetch rejects', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockRejectedValue(new Error('boom'));
    render(<TaxConfigurationManager />);
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to load tax configurations', { variant: 'error' }),
    );
  });

  it('renders the empty state when there are no configurations', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockResolvedValue([]);
    render(<TaxConfigurationManager />);
    expect(await screen.findByText('No tax configurations found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create First Tax Configuration' })).toBeInTheDocument();
  });

  it('toggles a configuration via updateTaxConfiguration with the flipped isEnabled', async () => {
    render(<TaxConfigurationManager />);
    await screen.findByText('VAT');
    // VAT is enabled → its toggle button reads "Disable".
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tax-1', isEnabled: false })),
    );
  });

  it('creates a configuration via createTaxConfiguration on submit', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockResolvedValue([]);
    render(<TaxConfigurationManager />);
    const rateInput = await openCreateForm();
    fireEvent.change(screen.getByPlaceholderText('e.g., VAT, Sales Tax'), { target: { value: 'GST' } });
    fireEvent.change(rateInput, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'GST', rate: 8 })));
  });

  it('edits a configuration via updateTaxConfiguration carrying the id', async () => {
    render(<TaxConfigurationManager />);
    await screen.findByText('VAT');
    // First edit button belongs to VAT (tax-1).
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    expect(await screen.findByText('Edit Tax Configuration')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'tax-1', name: 'VAT' })));
  });

  it('deletes a configuration through the confirmation modal', async () => {
    render(<TaxConfigurationManager />);
    await screen.findByText('VAT');
    // First delete button belongs to VAT (tax-1); confirm in the shared modal.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'yes' }));
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('tax-1'));
  });

  it('rejects rates below 0, above 100, and NaN with a validation error', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockResolvedValue([]);
    render(<TaxConfigurationManager />);
    const rateInput = await openCreateForm();

    fireEvent.change(rateInput, { target: { value: '-5' } });
    expect(screen.getByText(ERROR_MSG)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    fireEvent.change(rateInput, { target: { value: '150' } });
    expect(screen.getByText(ERROR_MSG)).toBeInTheDocument();

    fireEvent.change(rateInput, { target: { value: 'abc' } });
    expect(screen.getByText(ERROR_MSG)).toBeInTheDocument();
  });

  it('accepts rates across the 0–100 range (boundaries included)', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockResolvedValue([]);
    render(<TaxConfigurationManager />);
    const rateInput = await openCreateForm();

    for (const value of ['0', '100', '8.1']) {
      fireEvent.change(rateInput, { target: { value } });
      expect(screen.queryByText(ERROR_MSG)).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('closes the form without persisting when Cancel is clicked', async () => {
    mockGetAll.mockReset();
    mockGetAll.mockResolvedValue([]);
    render(<TaxConfigurationManager />);
    await openCreateForm();
    expect(screen.getByText('Create Tax Configuration')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Create Tax Configuration')).not.toBeInTheDocument();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
