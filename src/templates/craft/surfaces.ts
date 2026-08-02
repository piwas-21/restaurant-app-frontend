// Craft's per-surface overrides (S15 T4). Each entry is a genuinely-distinct
// craft rendering of a shared customer surface, resolved via `surfaceOr` and
// bundled only in the craft build.
import type { TemplateSurfaces } from '../types';
import CraftMenuCard from './surfaces/CraftMenuCard';
import CraftFeaturedSpecial from './surfaces/CraftFeaturedSpecial';
import CraftCategoryNav from './surfaces/CraftCategoryNav';
import CraftMenuSectionStatus from './surfaces/CraftMenuSectionStatus';
import CraftOrderFlowSidebar from './surfaces/CraftOrderFlowSidebar';
import CraftCartContents from './surfaces/CraftCartContents';

export const surfaces: TemplateSurfaces = {
  MenuCard: CraftMenuCard,
  FeaturedSpecial: CraftFeaturedSpecial,
  CategoryNav: CraftCategoryNav,
  MenuSectionStatus: CraftMenuSectionStatus,
  OrderFlowSidebar: CraftOrderFlowSidebar,
  CartContents: CraftCartContents,
};
