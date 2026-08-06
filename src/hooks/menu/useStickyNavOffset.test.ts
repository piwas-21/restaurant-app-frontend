import { act, renderHook } from '@testing-library/react';
import { STICKY_BANNER_ATTR, useStickyNavOffset } from './useStickyNavOffset';
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
