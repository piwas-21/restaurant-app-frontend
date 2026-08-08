import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import MenuContent from './MenuContent';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';
import type { MenuSectionStatusProps } from './MenuSectionStatus';

/**
 * What `MenuContent` decides on the status surface's behalf (S10).
 *
 * Rendered with the two children stubbed rather than mounted: the grid pulls in `MenuCard` and its
 * whole context tree, and none of that is the subject. What is the subject is a routing decision
 * one component up — which handler reaches the empty state — and a stub is the only way to read a
 * prop that a rendered button would only tell us about indirectly.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, arg?: unknown) => (typeof arg === 'string' ? arg : key) }),
}));
jest.mock('./MenuList', () => () => null);
jest.mock('@/components/common/Pagination', () => () => null);

const captured: MenuSectionStatusProps[] = [];
jest.mock('@/components/menu/MenuSectionStatus', () => (props: MenuSectionStatusProps) => {
  captured.push(props);
  return null;
});

const base = {
  categoryDisplayName: 'Grills',
  isLoadingItems: false,
  errorLoadingItems: null,
  currentMenuItems: [],
  menuBundles: [],
  currentPage: 1,
  totalPages: 1,
  totalCount: 0,
  onPageChange: jest.fn(),
  onOpenItem: jest.fn(),
};

describe('MenuContent — what it hands the status surface', () => {
  beforeEach(() => {
    captured.length = 0;
  });

  /**
   * D5's escape hatch is offered from a dead category, and withheld on the full menu.
   *
   * The second half is the one worth pinning: on `ALL_ITEMS_KEY` the button would take a guest to
   * the page they are already looking at, which reads as broken rather than as helpful — and it is
   * the state a guest reaches by pressing the button itself, so a missing guard makes it a loop.
   */
  it.each([
    ['a category', 'cat-1', true],
    ['the combos view', MENU_BUNDLES_KEY, true],
    ['the full menu', ALL_ITEMS_KEY, false],
  ])('offers a way out of %s: %s', (_label, selectedView, offered) => {
    const onBrowseFullMenu = jest.fn();
    render(<MenuContent {...base} selectedView={selectedView} onBrowseFullMenu={onBrowseFullMenu} />);

    expect(captured.at(-1)?.onBrowseFullMenu === undefined).toBe(!offered);
  });

  /** Retry is not view-dependent — every view can fail, and every failure can be retried. */
  it.each([ALL_ITEMS_KEY, MENU_BUNDLES_KEY, 'cat-1'])('always forwards retry (%s)', (selectedView) => {
    const onRetry = jest.fn();
    render(<MenuContent {...base} selectedView={selectedView} errorLoadingItems="boom" onRetry={onRetry} />);

    expect(captured.at(-1)?.onRetry).toBe(onRetry);
  });
});
