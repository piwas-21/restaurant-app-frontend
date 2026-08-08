import { act, renderHook } from '@testing-library/react';
import { STICKY_BANNER_ATTR, STICKY_NAV_ATTR, useStickyNavOffset } from './useStickyNavOffset';
import { useTableContext } from '@/contexts/TableContext';

jest.mock('@/contexts/TableContext', () => ({ useTableContext: jest.fn() }));

const mockedTableContext = useTableContext as jest.Mock;

/**
 * Behaviour of the sticky-nav offset. The sibling `categoryNavStickyOffset.test.ts` pins the SHAPE
 * of the fix by reading the stylesheet — it cannot tell whether the effect ever runs, whether the
 * measurement reaches state, or whether the observer is cleaned up. This covers those.
 *
 * The defect being guarded: `CategoryNav.module.css` hardcoded `top: 130px` ("80px header + 50px
 * TableBanner") while `TableBanner` renders nothing unless the guest scanned a table QR — so an
 * ordinary mobile visit reserved 50px for a banner that was not there. And the banner is not 50px
 * anyway; it measures 64px at 390px wide, which is why the height is measured rather than asserted.
 */

/** Puts a marked banner in the document at a given height, as `TableBanner` does. */
function mountBanner(height: number): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute(STICKY_BANNER_ATTR, '');
  el.getBoundingClientRect = () => ({ height, width: 390, top: 0, left: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  // `replaceChildren()`, not `innerHTML = ''` — same effect, and it does not put an innerHTML
  // assignment in the tree for the next reader (or the secret/XSS scanners) to weigh up.
  document.body.replaceChildren();
  jest.clearAllMocks();
});

describe('useStickyNavOffset', () => {
  it('reserves nothing when the guest did not arrive by QR scan', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });

    const { result } = renderHook(() => useStickyNavOffset());

    // The whole reported bug in one assertion: no banner, no reserved band.
    expect(result.current['--menu-banner-offset' as keyof typeof result.current]).toBe('0px');
    expect(result.current['--menu-header-offset' as keyof typeof result.current]).toBe('80px');
  });

  it('reserves the banner MEASURED height, not a constant', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: true });
    mountBanner(64);

    const { result } = renderHook(() => useStickyNavOffset());

    // 64, the real height at 390px — not the 50px the stylesheet used to assume.
    expect(result.current['--menu-banner-offset' as keyof typeof result.current]).toBe('64px');
  });

  it('ignores a banner in the DOM when there is no table context', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });
    mountBanner(64);

    const { result } = renderHook(() => useStickyNavOffset());

    expect(result.current['--menu-banner-offset' as keyof typeof result.current]).toBe('0px');
  });

  it('re-measures when the banner resizes (window fallback, no ResizeObserver)', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: true });
    const el = mountBanner(64);

    const { result } = renderHook(() => useStickyNavOffset());
    expect(result.current['--menu-banner-offset' as keyof typeof result.current]).toBe('64px');

    // A longer table label wraps to a second line — the exact drift a hardcoded number could not
    // follow, and why this is measured.
    el.getBoundingClientRect = () => ({ height: 92, width: 390, top: 0, left: 0 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current['--menu-banner-offset' as keyof typeof result.current]).toBe('92px');
  });

  it('observes the banner element and disconnects on unmount where ResizeObserver exists', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: true });
    mountBanner(64);

    const observe = jest.fn();
    const disconnect = jest.fn();
    // jsdom has no ResizeObserver, so the browser path needs an explicit stand-in — same approach
    // as hooks/floorPlan/useStageScale.test.ts.
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: class {
        observe = observe;
        disconnect = disconnect;
      },
    });
    try {
      const { unmount } = renderHook(() => useStickyNavOffset());
      expect(observe).toHaveBeenCalledTimes(1);
      unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
  });

  it('does not throw where ResizeObserver is absent — the jsdom/older-browser path', () => {
    mockedTableContext.mockReturnValue({ hasTableContext: true });
    mountBanner(64);

    expect(globalThis.ResizeObserver).toBeUndefined();
    expect(() => renderHook(() => useStickyNavOffset())).not.toThrow();
  });
});

/**
 * `--menu-nav-offset` (S6), which the basket rail sticks below.
 *
 * The banner cases above all mount their element BEFORE the hook renders, and that is the one
 * arrangement the nav never has: `MenuPage` returns `null` until it is both mounted and holding a
 * selected view, so the first effect pass runs against an empty document. A `querySelector` that
 * gives up when it finds nothing published `0px` for the page's whole life — and nothing would have
 * caught it, because the rail's `top` still *looked* right in the stylesheet.
 */
describe('useStickyNavOffset — the category bar', () => {
  /** Puts a marked nav in the document at a given height, as `CategoryNavShell` does. */
  function mountNav(height: number): HTMLElement {
    const el = document.createElement('nav');
    el.setAttribute(STICKY_NAV_ATTR, '');
    el.getBoundingClientRect = () => ({ height, width: 1280, top: 80, left: 0 }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  /** Lets the MutationObserver deliver — it is a microtask, so awaiting a tick is enough. */
  async function settle(): Promise<void> {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('reserves the nav MEASURED height, not a constant', async () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });
    mountNav(66.75);

    const { result } = renderHook(() => useStickyNavOffset());

    // The real height on the seeded catalogue, where one category carries an order-type sublabel.
    // A constant would have been 45px — what the bar measures before it has its second line.
    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('66.75px');
  });

  it('measures a nav that mounts AFTER the hook — the case the rail actually has', async () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });

    const { result } = renderHook(() => useStickyNavOffset());
    // MenuPage rendered `null`: nothing to measure yet, and no reservation claimed.
    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('0px');

    mountNav(66.75);
    await settle();

    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('66.75px');
  });

  it('follows the nav when React REPLACES the node rather than resizing it', async () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });
    const first = mountNav(45);

    const { result } = renderHook(() => useStickyNavOffset());
    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('45px');

    // Exactly what shipped in the first attempt: an observer bound to a node React had already
    // swapped out, publishing 45px against a live 66.75px bar. Only re-querying on mutation catches
    // it — a ResizeObserver on the old node stays silent forever, because a detached element does
    // not resize.
    first.remove();
    mountNav(66.75);
    await settle();

    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('66.75px');
  });

  it('drops the reservation when the nav goes away', async () => {
    mockedTableContext.mockReturnValue({ hasTableContext: false });
    const nav = mountNav(66.75);

    const { result } = renderHook(() => useStickyNavOffset());
    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('66.75px');

    nav.remove();
    await settle();

    // Same rule the banner established: no element, no reserved band.
    expect(result.current['--menu-nav-offset' as keyof typeof result.current]).toBe('0px');
  });
});
