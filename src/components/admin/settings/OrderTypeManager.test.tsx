import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrderTypeManager from './OrderTypeManager';
import { orderTypeConfigurationService } from '@/services/orderTypeConfigurationService';
import { OrderType } from '@/types/order';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: Record<string, string | number>) =>
      Object.entries(values ?? {}).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        fallback ?? key,
      ),
  }),
}));

const mockEnqueueSnackbar = jest.fn();
jest.mock('notistack', () => ({
  enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args),
}));

jest.mock('@/services/orderTypeConfigurationService', () => ({
  ...jest.requireActual('@/services/orderTypeConfigurationService'),
  orderTypeConfigurationService: { getAll: jest.fn(), update: jest.fn() },
}));

const mockGetAll = orderTypeConfigurationService.getAll as jest.MockedFunction<
  typeof orderTypeConfigurationService.getAll
>;
const mockUpdate = orderTypeConfigurationService.update as jest.MockedFunction<
  typeof orderTypeConfigurationService.update
>;

const configurations = [
  {
    orderType: OrderType.DineIn,
    isEnabled: true,
    displayOrder: 0,
    confirmationFlow: 'direct' as const,
    reviewWindowMinutes: 2,
  },
  {
    orderType: OrderType.Takeaway,
    isEnabled: true,
    displayOrder: 1,
    confirmationFlow: 'direct' as const,
    reviewWindowMinutes: 2,
  },
  {
    orderType: OrderType.Delivery,
    isEnabled: true,
    displayOrder: 2,
    confirmationFlow: 'acknowledge' as const,
    reviewWindowMinutes: 5,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAll.mockResolvedValue(configurations);
  mockUpdate.mockImplementation(async (dto) => ({
    displayOrder: configurations.find((item) => item.orderType === dto.orderType)?.displayOrder ?? 0,
    confirmationFlow: dto.confirmationFlow ?? 'direct',
    reviewWindowMinutes: dto.reviewWindowMinutes ?? 2,
    ...dto,
  }));
});

describe('OrderTypeManager confirmation settings', () => {
  it('shows flow controls for takeaway and delivery, but not dine-in', async () => {
    render(<OrderTypeManager />);

    expect(await screen.findByRole('combobox', { name: 'Takeaway Confirmation flow' })).toHaveValue('direct');
    expect(screen.getByRole('combobox', { name: 'Delivery Confirmation flow' })).toHaveValue('acknowledge');
    expect(screen.queryByRole('combobox', { name: 'Dine In Confirmation flow' })).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Delivery Review window (minutes)' })).toHaveValue(5);
    expect(screen.queryByRole('spinbutton', { name: 'Takeaway Review window (minutes)' })).not.toBeInTheDocument();
  });

  it('persists acknowledge with the existing review window and reveals its input', async () => {
    render(<OrderTypeManager />);
    const select = await screen.findByRole('combobox', { name: 'Takeaway Confirmation flow' });

    fireEvent.change(select, { target: { value: 'acknowledge' } });

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        orderType: OrderType.Takeaway,
        isEnabled: true,
        confirmationFlow: 'acknowledge',
        reviewWindowMinutes: 2,
      }),
    );
    expect(await screen.findByRole('spinbutton', { name: 'Takeaway Review window (minutes)' })).toHaveValue(2);
  });

  it('persists only an integer review window from 1 through 60', async () => {
    render(<OrderTypeManager />);
    const input = await screen.findByRole('spinbutton', { name: 'Delivery Review window (minutes)' });

    fireEvent.change(input, { target: { value: '61' } });
    fireEvent.blur(input);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(await screen.findByText('Enter a whole number from 1 to 60 minutes.')).toBeInTheDocument();
    expect(input).toHaveValue(61);

    fireEvent.change(input, { target: { value: '10' } });
    expect(screen.queryByText('Enter a whole number from 1 to 60 minutes.')).not.toBeInTheDocument();
    fireEvent.blur(input);

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        orderType: OrderType.Delivery,
        isEnabled: true,
        reviewWindowMinutes: 10,
      }),
    );
  });

  it('does not overwrite acknowledge settings when the type is disabled', async () => {
    render(<OrderTypeManager />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Delivery' }));
    fireEvent.click(screen.getByRole('button', { name: 'yes' }));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        orderType: OrderType.Delivery,
        isEnabled: false,
      }),
    );
  });

  it('hides the review window when direct confirmation is selected', async () => {
    render(<OrderTypeManager />);
    const select = await screen.findByRole('combobox', { name: 'Delivery Confirmation flow' });

    fireEvent.change(select, { target: { value: 'direct' } });

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith({
        orderType: OrderType.Delivery,
        isEnabled: true,
        confirmationFlow: 'direct',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('spinbutton', { name: 'Delivery Review window (minutes)' })).not.toBeInTheDocument(),
    );
  });
});
