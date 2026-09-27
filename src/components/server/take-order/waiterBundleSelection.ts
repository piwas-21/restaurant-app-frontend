import { buildDefaultBundleSelection } from '@/utils/bundleSelection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';

/** The waiter keeps its existing bundle defaults, including fixed Plat, regardless of guest availability. */
export function buildWaiterBundleDefaultSelection(sections: readonly MenuSection[]): SelectedMenuOption[] {
  return buildDefaultBundleSelection(sections);
}
