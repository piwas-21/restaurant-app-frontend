import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MembersTable from '../member-management/MembersTable';
import { TaxSelectionModal } from '../TaxSelectionModal';
import { adminTaxConfigurationService } from '@/services/adminTaxConfigurationService';
import { ApiError } from '@/utils/apiClient';
import { OrderType } from '@/types/order';
import type { UserDto } from '@/types/user';

/**
 * Two DISTINCT `t` references behind a mutable holder — see the same setup in
 * `SuggestedSideItemsPicker.test.tsx`. A single hoisted `t` is stable across BOTH re-render and
 * language change, so it certifies the bug `useStableT` prevents instead of catching it: mutation
 * testing confirmed that with the one-function mock, swapping `useApplicableTaxes`' `tRef` for a
 * raw `t` in the effect deps left every test in this file green.
 */
const mockTEn = (key: string, fallback?: string) => fallback ?? key;
const mockTDe = (key: string, fallback?: string) => fallback ?? key;
let mockCurrentT: typeof mockTEn = mockTEn;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockCurrentT }),
}));

jest.mock('@/hooks/useRoleHelpers', () => ({
  useRoleHelpers: () => ({ getRoleLabel: (r: string) => r, getRoleClassName: () => '' }),
}));

jest.mock('@/services/adminTaxConfigurationService', () => ({
  adminTaxConfigurationService: { getAllTaxConfigurations: jest.fn() },
}));

const mockGetAllTaxes = adminTaxConfigurationService.getAllTaxConfigurations as jest.MockedFunction<
  typeof adminTaxConfigurationService.getAllTaxConfigurations
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrentT = mockTEn;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

const user = (createdAt: string | undefined): UserDto =>
  ({
    id: 'u1',
    firstName: 'Ada',
    lastName: 'Byron',
    email: 'ada@example.com',
    phoneNumber: null,
    role: 'Admin',
    isDeleted: false,
    createdAt,
  }) as unknown as UserDto;

describe('MembersTable — the date catch that could never fire', () => {
  const noop = () => {};

  /**
   * The Created cell specifically.
   *
   * An earlier version of this suite asserted `getAllByText('-').length > 0`, which passed no
   * matter what the date column rendered: the fixture's `phoneNumber` is null and MembersTable
   * renders its own `-` for that. Asserting on "some dash exists somewhere in the table" is not
   * asserting on the thing under test.
   */
  const createdCell = () => {
    const row = screen.getByRole('row', { name: /Ada/ });
    // Columns: first, last, email, phone, role, status, created, actions.
    return within(row).getAllByRole('cell')[6];
  };

  it('renders "-" in the Created cell for an unparseable date, not the string "Invalid Date"', () => {
    // `new Date('not-a-date').toLocaleDateString()` RETURNS "Invalid Date"; it does not throw. The
    // `try/catch` this replaced was therefore dead and its `-` unreachable.
    render(<MembersTable users={[user('not-a-date')]} onEdit={noop} onDelete={noop} />);

    expect(createdCell()).toHaveTextContent('-');
    expect(createdCell()).not.toHaveTextContent('Invalid Date');
  });

  it('renders "-" in the Created cell when the field is absent', () => {
    render(<MembersTable users={[user(undefined)]} onEdit={noop} onDelete={noop} />);

    expect(createdCell()).toHaveTextContent('-');
  });

  it('still formats a real date', () => {
    render(<MembersTable users={[user('2026-08-03T10:00:00Z')]} onEdit={noop} onDelete={noop} />);

    expect(createdCell()).toHaveTextContent(new Date('2026-08-03T10:00:00Z').toLocaleDateString());
  });
});

describe('TaxSelectionModal — an outage must not read as "none configured"', () => {
  const props = {
    isOpen: true,
    onClose: () => {},
    onSelectTax: () => {},
    currentOrderType: OrderType.Takeaway,
  };

  it('shows the server’s reason and suppresses the empty state when the load fails', async () => {
    mockGetAllTaxes.mockRejectedValue(new ApiError(500, 'Tax service is unavailable'));

    render(<TaxSelectionModal {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Tax service is unavailable');
    // The load failed, so the screen must not answer a question about the configuration.
    expect(screen.queryByText(/No tax configurations available/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Please create a tax configuration/i)).not.toBeInTheDocument();
  });

  it('disables Confirm while the load error is showing', async () => {
    // Otherwise Confirm resolves off an empty list to `no tax` and closes — committing a tax
    // decision, and clearing any already-set `currentTaxId`, on the strength of a failed read.
    // Suppressing the misleading text while leaving the misleading action is half a fix.
    mockGetAllTaxes.mockRejectedValue(new ApiError(500, 'Tax service is unavailable'));
    const onSelectTax = jest.fn();

    render(<TaxSelectionModal {...props} currentTaxId="tax-1" onSelectTax={onSelectTax} />);

    await screen.findByRole('alert');
    const confirm = screen.getByRole('button', { name: 'Confirm Selection' });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onSelectTax).not.toHaveBeenCalled();
  });

  it('falls back to a translated sentence when the server authored none', async () => {
    mockGetAllTaxes.mockRejectedValue(new ApiError(0, ''));

    render(<TaxSelectionModal {...props} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tax rates');
  });

  it('still shows the empty state when the server genuinely returns no taxes', async () => {
    mockGetAllTaxes.mockResolvedValue([]);

    render(<TaxSelectionModal {...props} />);

    expect(await screen.findByText(/No tax configurations available/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not refetch when only the language changes', async () => {
    mockGetAllTaxes.mockResolvedValue([]);

    const { rerender } = render(<TaxSelectionModal {...props} />);
    await screen.findByText(/No tax configurations available/i);
    expect(mockGetAllTaxes).toHaveBeenCalledTimes(1);

    mockCurrentT = mockTDe; // what `languageChanged` does to `t`'s identity
    rerender(<TaxSelectionModal {...props} />);

    await waitFor(() => expect(screen.getByText(/No tax configurations available/i)).toBeInTheDocument());
    expect(mockGetAllTaxes).toHaveBeenCalledTimes(1);
  });

  it('re-filters on an order-type change WITHOUT refetching', async () => {
    // The request takes no order type — only the filter does. Refetching here would be work the
    // original `[isOpen]` effect never did, and with two loads in flight the slower first one
    // could overwrite the second, leaving a tax on screen that does not apply.
    const takeawayOnly = {
      id: 't1',
      name: 'Takeaway VAT',
      description: '',
      rate: 0.025,
      isEnabled: true,
      applicableOrderTypes: [OrderType.Takeaway],
    } as unknown as Awaited<ReturnType<typeof adminTaxConfigurationService.getAllTaxConfigurations>>[number];
    mockGetAllTaxes.mockResolvedValue([takeawayOnly]);

    const { rerender } = render(<TaxSelectionModal {...props} />);
    expect(await screen.findByText('Takeaway VAT')).toBeInTheDocument();

    rerender(<TaxSelectionModal {...props} currentOrderType={OrderType.Delivery} />);

    await waitFor(() => expect(screen.queryByText('Takeaway VAT')).not.toBeInTheDocument());
    expect(screen.getByText(/No tax configurations available/i)).toBeInTheDocument();
    expect(mockGetAllTaxes).toHaveBeenCalledTimes(1);
  });

  it('retries the load and clears the error on success', async () => {
    mockGetAllTaxes.mockRejectedValueOnce(new ApiError(500, 'Tax service is unavailable')).mockResolvedValueOnce([]);

    render(<TaxSelectionModal {...props} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByText(/No tax configurations available/i)).toBeInTheDocument();
  });
});
