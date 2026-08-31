/**
 * The public landing-page contract — `GET /api/restaurant-info/landing` and its admin PUT
 * (backend `LandingPageDto`). Kept separate from {@link RestaurantInfoDto} on purpose: the
 * profile is one full-replace admin row, while the landing page is read anonymously by every
 * tenant frontend and carries per-language copy overrides.
 */

/** How the landing page resolves its hero background image. */
export type LandingBackgroundMode = 'default' | 'custom' | 'none';

/** Copy overrides for one locale. A null member means "use the bundled translation". */
export interface LandingPageContentDto {
  heroEyebrow: string | null;
  welcomeTitle: string | null;
  welcomeBody: string | null;
  storyTitle: string | null;
  storyBody: string | null;
}

export interface LandingPageDto {
  backgroundMode: LandingBackgroundMode;
  /** The tenant's upload, absolute; null unless mode is `custom`. */
  backgroundImageUrl: string | null;
  /** Keyed by normalized language code (`en`, `de`, …). */
  content: Record<string, LandingPageContentDto>;
}

/** One locale supplied by the admin on a landing-page replacement. */
export interface UpdateLandingPageContentDto {
  languageCode: string | null;
  heroEyebrow: string | null;
  welcomeTitle: string | null;
  welcomeBody: string | null;
  storyTitle: string | null;
  storyBody: string | null;
}

export interface UpdateLandingPageCommand {
  backgroundMode: LandingBackgroundMode;
  content: UpdateLandingPageContentDto[];
}
