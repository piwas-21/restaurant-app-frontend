// Craft's per-surface overrides (S15 T4). Each entry is a genuinely-distinct
// craft rendering of a shared customer surface, resolved via `surfaceOr` and
// bundled only in the craft build.
import type { TemplateSurfaces } from '../types';
import CraftMenuCard from './surfaces/CraftMenuCard';

export const surfaces: TemplateSurfaces = {
  MenuCard: CraftMenuCard,
};
