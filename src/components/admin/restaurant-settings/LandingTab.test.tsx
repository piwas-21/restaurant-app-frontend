import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LandingTab from './LandingTab';
import * as infoService from '@/services/restaurantInfoService';
import * as infoHook from '@/hooks/useRestaurantInfo';
import * as landingHook from '@/hooks/useLandingPage';
import type { LandingPageDto } from '@/types/landingPage';

jest.mock('@/services/restaurantInfoService');
jest.mock('@/hooks/useRestaurantInfo');
jest.mock('@/hooks/useLandingPage');
jest.mock('notistack', () => ({ useSnackbar: () => ({ enqueueSnackbar: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  // The keys ARE the assertions — a translated string would let a wrong key pass by
  // rendering some other locale value that happens to read plausibly.
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockedService = infoService as jest.Mocked<typeof infoService>;
const mockedInfoHook = infoHook as jest.Mocked<typeof infoHook>;
const mockedLandingHook = landingHook as jest.Mocked<typeof landingHook>;

const infoWithUpload = { info: { name: 'Kebab Dilhan', interiorImageUrl: 'https://cdn.example/room.webp' } } as never;

const landingDto = (overrides: Partial<LandingPageDto> = {}): LandingPageDto => ({
  backgroundMode: 'default',
  backgroundImageUrl: null,
  content: {
    en: { heroEyebrow: null, welcomeTitle: 'Old title', welcomeBody: null, storyTitle: null, storyBody: 'Old story' },
  },
  ...overrides,
});

const answerLanding = (dto: LandingPageDto | null = landingDto()) => {
  mockedLandingHook.useLandingPage.mockReturnValue({ landing: dto });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedInfoHook.useRestaurantInfo.mockReturnValue({
    info: { name: 'Kebab Dilhan', interiorImageUrl: null },
  } as never);
  mockedService.getLandingPage.mockResolvedValue({ success: true, data: landingDto() } as never);
  answerLanding();
});

describe('LandingTab — background mode', () => {
  it('disables the custom mode until a photo is uploaded, and says why', () => {
    render(<LandingTab />);

    const custom = screen.getByRole('radio', { name: 'landing_mode_custom' });
    expect(custom).toBeDisabled();
    expect(screen.getByText('landing_mode_custom_needs_upload')).toBeInTheDocument();
  });

  it('unlocks the custom mode once an interior photo exists', () => {
    mockedInfoHook.useRestaurantInfo.mockReturnValue(infoWithUpload);

    render(<LandingTab />);

    expect(screen.getByRole('radio', { name: 'landing_mode_custom' })).toBeEnabled();
  });

  it('seeds the mode from the saved landing, not always the default', () => {
    answerLanding(landingDto({ backgroundMode: 'none' }));

    render(<LandingTab />);

    expect(screen.getByRole('radio', { name: 'landing_mode_none' })).toBeChecked();
  });
});

describe('LandingTab — the full-replace save', () => {
  it('PUTs the edited language AND the untouched loaded rows, blank rows dropped', async () => {
    mockedService.updateLandingPage.mockResolvedValue({ success: true, data: landingDto() } as never);

    render(<LandingTab />);
    await screen.findByDisplayValue('Old title');

    // The German row is added while the English row must survive the replace.
    fireEvent.change(screen.getByLabelText('landing_language'), { target: { value: 'de' } });
    fireEvent.change(screen.getByLabelText('landing_welcome_title'), { target: { value: 'Willkommen' } });
    // …and the English story body is cleared, which removes the row entirely.
    fireEvent.change(screen.getByLabelText('landing_language'), { target: { value: 'en' } });
    fireEvent.change(screen.getByLabelText('landing_story_body'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockedService.updateLandingPage).toHaveBeenCalled());
    const command = mockedService.updateLandingPage.mock.calls[0][0];
    expect(command.backgroundMode).toBe('default');
    const en = command.content.find((row) => row.languageCode === 'en');
    const de = command.content.find((row) => row.languageCode === 'de');
    expect(en).toMatchObject({ welcomeTitle: 'Old title', storyBody: null });
    expect(de).toMatchObject({ welcomeTitle: 'Willkommen' });
    // A locale the admin never touched is carried verbatim, not silently deleted.
    expect(command.content.find((row) => row.languageCode === undefined)).toBeUndefined();
    expect(command.content.length).toBe(2);
  });

  it('trims copy and stores blanks as null, so the guest falls back to bundled copy', async () => {
    mockedService.updateLandingPage.mockResolvedValue({ success: true, data: landingDto() } as never);

    render(<LandingTab />);
    await screen.findByDisplayValue('Old title');
    fireEvent.change(screen.getByLabelText('landing_welcome_title'), { target: { value: '  Hoş geldiniz  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(mockedService.updateLandingPage).toHaveBeenCalled());
    const en = mockedService.updateLandingPage.mock.calls[0][0].content.find((row) => row.languageCode === 'en');
    expect(en?.welcomeTitle).toBe('Hoş geldiniz');
  });

  it('invalidates the guest-side cache after a successful save', async () => {
    const invalidate = jest.spyOn(landingHook, 'invalidateLandingPageCache');
    mockedService.updateLandingPage.mockResolvedValue({ success: true, data: landingDto() } as never);

    render(<LandingTab />);
    await screen.findByDisplayValue('Old title');
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });
});
