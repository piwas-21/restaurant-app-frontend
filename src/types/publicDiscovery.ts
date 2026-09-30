import type { LanguageCode } from '@/config/languageConfig';
import type { LandingPageDto } from '@/types/landingPage';
import type { ApiCategory } from '@/types/menu';
import type { MenuBundleDto, ProductDto } from '@/hooks/publicMenu/types';
import type { RestaurantInfoDto } from '@/types/restaurantInfo';
import type { WorkingHoursDto } from '@/types/workingHours';
import type { CatalogOfferFamily } from '@/types/menu/offerFamily';

export interface PublicHomeData {
  locale: LanguageCode;
  restaurantInfo: RestaurantInfoDto | null;
  landingPage: LandingPageDto | null;
  landingKnown: boolean;
  workingHours: WorkingHoursDto[];
}

export interface PublicHomePageProps {
  initialData?: PublicHomeData;
}

export interface PublicMenuPageData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  items: ProductDto[];
}

export interface PublicMenuBundlePageData extends Omit<PublicMenuPageData, 'items'> {
  items: MenuBundleDto[];
}

export interface PublicMenuOfferPageData {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
}

export interface PublicMenuClientData {
  locale: LanguageCode;
  categories: ApiCategory[];
  /** False means SSR category fetch was incomplete and the client should retry before settling. */
  categoriesComplete: boolean;
  products: PublicMenuPageData;
  bundles: PublicMenuBundlePageData;
  productsByCategory: Record<string, ProductDto[]>;
  offerFamilies: CatalogOfferFamily[];
  offerPage: PublicMenuOfferPageData;
  restaurantInfo: RestaurantInfoDto | null;
}
