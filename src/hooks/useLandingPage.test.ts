import { renderHook, waitFor } from '@testing-library/react';
import { getLandingPage } from '@/services/restaurantInfoService';
import type { LandingPageDto } from '@/types/landingPage';
import { invalidateLandingPageCache, useLandingPage } from './useLandingPage';

jest.mock('@/services/restaurantInfoService', () => ({ getLandingPage: jest.fn() }));

const mockGetLandingPage = getLandingPage as jest.Mock;

const authoredLanding: LandingPageDto = {
  backgroundMode: 'default',
  backgroundImageUrl: null,
  content: {
    en: {
      heroEyebrow: null,
      welcomeTitle: 'Authored title',
      welcomeBody: 'Authored welcome',
      storyTitle: null,
      storyBody: null,
    },
  },
};

describe('useLandingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    invalidateLandingPageCache();
  });

  it('keeps known server-rendered copy when the client refresh returns a failure envelope', async () => {
    mockGetLandingPage.mockResolvedValue({ success: false, data: null });
    const { result } = renderHook(() => useLandingPage(authoredLanding));

    await waitFor(() => expect(mockGetLandingPage).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.landing).toEqual(authoredLanding));
  });

  it('uses a valid client response to refresh the server-rendered snapshot', async () => {
    const updated = {
      ...authoredLanding,
      content: { ...authoredLanding.content, en: { ...authoredLanding.content.en, welcomeBody: 'Updated welcome' } },
    };
    mockGetLandingPage.mockResolvedValue({ success: true, data: updated });
    const { result } = renderHook(() => useLandingPage(authoredLanding));

    await waitFor(() => expect(result.current.landing).toEqual(updated));
  });
});
