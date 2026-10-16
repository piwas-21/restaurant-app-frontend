import { render, screen, waitFor } from '@testing-library/react';
import GuestOrderingUnavailable from './GuestOrderingUnavailable';
import { workingHoursService } from '@/services/workingHoursService';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/services/workingHoursService', () => ({ workingHoursService: { isOpenNow: jest.fn() } }));

beforeEach(() => jest.resetAllMocks());

it('explains hours closure only after the restaurant confirms it is closed', async () => {
  jest.mocked(workingHoursService.isOpenNow).mockResolvedValue(false);
  render(<GuestOrderingUnavailable reason="closed" onRetry={jest.fn()} />);
  expect(await screen.findByText('order_type_outside_opening_hours')).toBeInTheDocument();
});

it.each([true, undefined])('keeps the general notice when closure is not confirmed (%s)', async (isOpen) => {
  jest.mocked(workingHoursService.isOpenNow).mockResolvedValue(isOpen as boolean);
  render(<GuestOrderingUnavailable reason="closed" onRetry={jest.fn()} />);
  await waitFor(() => expect(workingHoursService.isOpenNow).toHaveBeenCalledTimes(1));
  expect(screen.getByText('order_type_closed_now')).toBeInTheDocument();
  expect(screen.queryByText('order_type_outside_opening_hours')).not.toBeInTheDocument();
});

it('does not describe an availability fetch failure as a restaurant closure', () => {
  render(<GuestOrderingUnavailable reason="unknown" onRetry={jest.fn()} />);
  expect(screen.getByText('order_type_availability_failed')).toBeInTheDocument();
  expect(workingHoursService.isOpenNow).not.toHaveBeenCalled();
});

it('keeps the general notice if the opening-hours check fails', async () => {
  jest.mocked(workingHoursService.isOpenNow).mockRejectedValue(new Error('offline'));
  render(<GuestOrderingUnavailable reason="closed" onRetry={jest.fn()} />);
  await waitFor(() => expect(workingHoursService.isOpenNow).toHaveBeenCalledTimes(1));
  expect(screen.queryByText('order_type_outside_opening_hours')).not.toBeInTheDocument();
});
