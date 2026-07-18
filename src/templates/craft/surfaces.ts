// Craft's per-surface overrides (S15 T4). Each entry is a genuinely-distinct
// craft rendering of a shared customer surface, resolved via `surfaceOr` and
// bundled only in the craft build.
import type { TemplateSurfaces } from '../types';
import CraftMenuCard from './surfaces/CraftMenuCard';
import CraftCategoryNav from './surfaces/CraftCategoryNav';
import CraftMenuSectionStatus from './surfaces/CraftMenuSectionStatus';

export const surfaces: TemplateSurfaces = {
  MenuCard: CraftMenuCard,
  CategoryNav: CraftCategoryNav,
  MenuSectionStatus: CraftMenuSectionStatus,
};
