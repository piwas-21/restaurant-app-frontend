import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ModulesProvider } from '@/contexts/ModulesContext';
import { lookupStaffCustomers } from '@/services/staffCustomerLookupService';
import type { StaffCustomerLookup } from '@/types/staffCustomer';
import StaffCustomerPicker from './StaffCustomerPicker';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/staffCustomerLookupService', () => ({ lookupStaffCustomers: jest.fn() }));

const mockLookup = lookupStaffCustomers as jest.MockedFunction<typeof lookupStaffCustomers>;
const customer: StaffCustomerLookup = {
  id: 'user-7',
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  email: 'ada@example.test',
  phoneNumber: '+41220000000',
  currentPoints: 120,
};

describe('StaffCustomerPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for two characters, explicitly selects a result and hides loyalty without its module', async () => {
    mockLookup.mockResolvedValue([customer]);
    const onChange = jest.fn();
    render(
      <ModulesProvider modules={['core', 'cashier', 'server']}>
        <StaffCustomerPicker onChange={onChange} />
      </ModulesProvider>,
    );

    const search = screen.getByLabelText('staff_customer.search_label');
    fireEvent.change(search, { target: { value: 'a' } });
    expect(mockLookup).not.toHaveBeenCalled();

    fireEvent.change(search, { target: { value: 'ad' } });
    await waitFor(() => expect(mockLookup).toHaveBeenCalledWith('ad'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Ada Lovelace/ })).toBeInTheDocument());
    expect(mockLookup).toHaveBeenCalledWith('ad');

    fireEvent.click(screen.getByRole('button', { name: /Ada Lovelace/ }));
    expect(onChange).toHaveBeenCalledWith({
      customerUserId: 'user-7',
      customerName: 'Ada Lovelace',
      customerEmail: 'ada@example.test',
      customerPhone: '+41220000000',
      currentPoints: 120,
      pointsToRedeem: 0,
    });
    expect(screen.queryByLabelText('staff_customer.points_to_redeem')).not.toBeInTheDocument();
  });
});
