import { buildDefaultBundleSelection } from '@/utils/bundleSelection';
import type { MenuSection, SelectedMenuOption } from '@/types/menu';

/** The waiter and guest sheets start from exactly the same bundle defaults, including fixed Plat. */
export function buildWaiterBundleDefaultSelection(sections: readonly MenuSection[]): SelectedMenuOption[] {
  return buildDefaultBundleSelection(sections);
}
