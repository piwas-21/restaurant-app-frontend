import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AppearanceTab from './AppearanceTab';
import { useRestaurantInfo, invalidateRestaurantInfoCache } from '@/hooks/useRestaurantInfo';
import { updateRestaurantInfo } from '@/services/restaurantInfoService';
import { revalidateTenantTheme } from '@/app/actions/revalidateTenantTheme';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';

/**
 * The Appearance tab's admin controls for the two menu-display settings (mcdoner
 * partner request). Pinned: the section renders the saved values, Save stays
 * disabled until something changed, and one save carries the palette AND both
 * menu-display fields through the full-upsert PUT — a palette save that wiped
 * them (or a layout save that wiped the palette) would be the exact field-loss
 * the full-upsert guard exists to prevent.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, arg?: unknown) => (typeof arg === 'string' ? arg : key) }),
}));
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('@/hooks/useRestaurantInfo', () => ({
  useRestaurantInfo: jest.fn(),
  invalidateRestaurantInfoCache: jest.fn(),
}));
jest.mock('@/services/restaurantInfoService', () => ({ updateRestaurantInfo: jest.fn() }));
jest.mock('@/app/actions/revalidateTenantTheme', () => ({ revalidateTenantTheme: jest.fn() }));

const mockUseRestaurantInfo = useRestaurantInfo as jest.Mock;
const mockUpdate = updateRestaurantInfo as jest.Mock;
const mockRevalidate = revalidateTenantTheme as jest.Mock;

function infoFixture(overrides: Partial<RestaurantInfoDto> = {}): RestaurantInfoDto {
  return {
    id: 'id-1',
    name: 'Rumi',
    addressLine1: 'Rue X 1',
    addressLine2: null,
    city: 'Genève',
    postalCode: '1202',
    country: 'Switzerland',
    latitude: null,
    longitude: null,
    email: 'contact@rumirestaurant.ch',
    website: null,
    themePaletteKey: null,
    logoUrl: null,
    logoDarkUrl: null,
    interiorImageUrl: null,
    phoneNumbers: [],
    menuLayout: 'tabs',
    showMenuBundlesOnAllTab: false,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRestaurantInfo.mockReturnValue({
    info: infoFixture(),
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
  });
  mockUpdate.mockResolvedValue({ success: true });
  mockRevalidate.mockResolvedValue(undefined);
});

function renderTab() {
  return render(<AppearanceTab />);
}

describe('AppearanceTab — menu display settings', () => {
  it('renders the saved menu-display values', () => {
    mockUseRestaurantInfo.mockReturnValue({
      info: infoFixture({ menuLayout: 'onepage', showMenuBundlesOnAllTab: true }),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    renderTab();

    expect(screen.getByRole('radio', { name: 'One page' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Category tabs' })).not.toBeChecked();
    expect(screen.getByTestId('show-bundles-on-all-tab')).toBeChecked();
  });

  it('Save stays disabled until a control changes', () => {
    renderTab();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: 'One page' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('saves the layout through the full-upsert PUT, palette riding along', async () => {
    renderTab();

    fireEvent.click(screen.getByRole('radio', { name: 'One page' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const command = mockUpdate.mock.calls[0][0];
    expect(command.menuLayout).toBe('onepage');
    // Unchanged fields ride along untouched — the PUT wipes anything omitted.
    expect(command.showMenuBundlesOnAllTab).toBe(false);
    expect(command.themePaletteKey).toBeNull();
    expect(command.name).toBe('Rumi');
    // And the singleton's other settings are not reset by the save.
    expect(command).not.toHaveProperty('logoUrl');
  });

  it('saves the bundles-on-All toggle on its own, without touching the layout', async () => {
    renderTab();

    fireEvent.click(screen.getByTestId('show-bundles-on-all-tab'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    const command = mockUpdate.mock.calls[0][0];
    expect(command.showMenuBundlesOnAllTab).toBe(true);
    expect(command.menuLayout).toBe('tabs');
  });

  it('reports success and refreshes the cache after a save', async () => {
    renderTab();

    fireEvent.click(screen.getByTestId('show-bundles-on-all-tab'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(invalidateRestaurantInfoCache).toHaveBeenCalled());
    await waitFor(() => expect(mockRevalidate).toHaveBeenCalled());
  });
});
