import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TipPreferencesTab from './TipPreferencesTab';
import { updateTipPreferences } from '@/services/tipPreferencesService';

const mockRefetch = jest.fn(async () => undefined);
const mockInfo = { currency: 'EUR', tipPreferences: { mode: 'percentage', values: [10, 15, 20], currency: null } };
jest.mock('@/hooks/useRestaurantInfo', () => ({
  useRestaurantInfo: () => ({ info: mockInfo, isLoading: false, error: null, refetch: mockRefetch }),
}));
jest.mock('@/services/tipPreferencesService', () => ({ updateTipPreferences: jest.fn() }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));

beforeEach(() => jest.clearAllMocks());

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
