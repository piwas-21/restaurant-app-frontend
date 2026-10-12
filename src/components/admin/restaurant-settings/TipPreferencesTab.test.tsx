import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TipPreferencesTab from './TipPreferencesTab';
import { ApiError } from '@/utils/apiClient';
import { updateTipPreferences } from '@/services/tipPreferencesService';

const mockRefetch = jest.fn(async () => undefined);
const mockInfo = {
  currency: 'EUR' as string | null,
  tipPreferences: { mode: 'percentage', values: [10, 15, 20], currency: null },
};
jest.mock('@/hooks/useRestaurantInfo', () => ({
  useRestaurantInfo: () => ({ info: mockInfo, isLoading: false, error: null, refetch: mockRefetch }),
}));
jest.mock('@/services/tipPreferencesService', () => ({ updateTipPreferences: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockInfo.currency = 'EUR';
});

it('saves admin-selected EUR 1/2/3/4 as exact minor units and refreshes the public preference cache', async () => {
  jest.mocked(updateTipPreferences).mockResolvedValue({
    success: true,
    message: '',
    data: { mode: 'fixed', values: [100, 200, 300, 400], currency: 'EUR' },
  });
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('radio', { name: 'tip_preferences.fixed' }));
  expect(screen.getByRole('radio', { name: 'tip_preferences.fixed' })).toBeChecked();
  expect(screen.getByLabelText('tip_preferences.preview')).toHaveTextContent('4,00');
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  await waitFor(() =>
    expect(updateTipPreferences).toHaveBeenCalledWith({ mode: 'fixed', values: [100, 200, 300, 400], currency: 'EUR' }),
  );
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('tip_preferences.saved')).toBeInTheDocument();
});

it('blocks duplicates and accepts a decimal-comma fixed amount', () => {
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('radio', { name: 'tip_preferences.fixed' }));
  const inputs = screen.getAllByRole('textbox');
  fireEvent.change(inputs[1], { target: { value: '1' } });
  expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
  fireEvent.change(inputs[1], { target: { value: '1,25' } });
  expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  expect(screen.getByLabelText('tip_preferences.preview')).toHaveTextContent('1,25');
});

it('accepts an optional sixth preset while intermediate preset fields stay empty', async () => {
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('radio', { name: 'tip_preferences.fixed' }));
  fireEvent.change(screen.getAllByRole('textbox')[5], { target: { value: '6' } });
  expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  await waitFor(() =>
    expect(updateTipPreferences).toHaveBeenCalledWith({
      mode: 'fixed',
      values: [100, 200, 300, 400, 600],
      currency: 'EUR',
    }),
  );
});

it('requires the configured restaurant currency before saving or previewing fixed tips', () => {
  mockInfo.currency = null;
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('radio', { name: 'tip_preferences.fixed' }));
  expect(screen.getByRole('alert')).toHaveTextContent('tip_preferences.currency_required');
  expect(screen.getByRole('button', { name: 'save' })).toBeDisabled();
  expect(screen.getByLabelText('tip_preferences.preview')).not.toHaveTextContent('€');
});

it('shows a presentable server rejection and keeps the entered presets for correction', async () => {
  jest.mocked(updateTipPreferences).mockRejectedValueOnce(new ApiError(400, 'Select the restaurant current currency.'));
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('radio', { name: 'tip_preferences.fixed' }));
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  expect(await screen.findByText('Select the restaurant current currency.')).toBeInTheDocument();
  expect(screen.getAllByRole('textbox')[0]).toHaveValue('1');
  expect(screen.getByRole('button', { name: 'save' })).toBeEnabled();
});

it('keeps raw transport details out of the visible save failure', async () => {
  jest.mocked(updateTipPreferences).mockRejectedValueOnce(new Error('private request detail'));
  render(<TipPreferencesTab />);
  fireEvent.click(screen.getByRole('button', { name: 'save' }));
  expect(await screen.findByText('tip_preferences.save_failed')).toBeInTheDocument();
  expect(screen.queryByText('private request detail')).not.toBeInTheDocument();
});
