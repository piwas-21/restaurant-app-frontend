import { act, renderHook, waitFor } from '@testing-library/react';
import { useCategoryNavScroll } from './useCategoryNavScroll';

/**
 * The hook had NO test, and the defect it carried was invisible to every gate this repo has: it
 * reasoned in `scrollLeft > 0`, which is `<= 0` for the whole of an RTL scroll.
 *
 * Per CSSOM-View, and in every browser this app ships to, a scroller reports `scrollLeft === 0` at
 * its INLINE START in both directions, growing positive toward the end in LTR and negative in RTL.
 * These tests drive both sign conventions through the same assertions, which is the only way a
 * physical-arithmetic regression here can fail a build.
 */

/** A scroller whose geometry and direction we control, since jsdom implements neither. */
function makeScroller(direction: 'ltr' | 'rtl') {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollWidth', { value: 1000, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 400, configurable: true });
  el.style.direction = direction;
  // jsdom's getComputedStyle honours the inline style, so the hook's direction probe is real.
  el.scrollBy = jest.fn();
  return el;
}

/**
 * Put `el` behind the hook's ref and let the effect run against it.
 *
 * The `resetKey` bump is load-bearing, not ceremony: on the first render the ref is still null, so
 * the effect returns before adding its `scroll` listener. React attaches a real ref between render
 * and effect; a test has to reproduce that ordering or it silently measures a hook that is not
 * listening to anything — and every assertion about a *moved* scroller would read the mount value.
 */
async function attach(el: HTMLDivElement) {
  const hook = renderHook(({ key }: { key: number }) => useCategoryNavScroll(key), {
    initialProps: { key: 0 },
  });
  (hook.result.current.scrollContainerRef as { current: HTMLDivElement | null }).current = el;
  hook.rerender({ key: 1 });
  await act(async () => {
    jest.advanceTimersByTime(150);
  });
  return hook;
}

/** Move the scroller and fire the event the hook listens for. */
async function scrollTo(el: HTMLDivElement, scrollLeft: number) {
  Object.defineProperty(el, 'scrollLeft', { value: scrollLeft, configurable: true });
  await act(async () => {
    el.dispatchEvent(new Event('scroll'));
  });
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe.each([
  // LTR travels 0 → +600; RTL travels 0 → -600. Same journey, opposite sign.
  ['ltr', 1] as const,
  ['rtl', -1] as const,
])('useCategoryNavScroll under dir=%s', (direction, sign) => {
  it('offers no back arrow at the inline start', async () => {
    const el = makeScroller(direction);
    await scrollTo(el, 0);
    const { result } = await attach(el);

    await waitFor(() => expect(result.current.canScrollForward).toBe(true));
    expect(result.current.canScrollBack).toBe(false);
  });

  it('offers BOTH arrows in the middle', async () => {
    const el = makeScroller(direction);
    const { result } = await attach(el);

    await scrollTo(el, 300 * sign);

    expect(result.current.canScrollBack).toBe(true);
    expect(result.current.canScrollForward).toBe(true);
  });

  it('drops the forward arrow at the far end', async () => {
    const el = makeScroller(direction);
    const { result } = await attach(el);

    // scrollWidth - clientWidth = 600.
    await scrollTo(el, 600 * sign);

    expect(result.current.canScrollBack).toBe(true);
    expect(result.current.canScrollForward).toBe(false);
  });

  it('ignores a sub-pixel resting offset rather than showing a dead back arrow', async () => {
    const el = makeScroller(direction);
    const { result } = await attach(el);

    await scrollTo(el, 0.5 * sign);

    expect(result.current.canScrollBack).toBe(false);
  });
});

/**
 * `scrollBy` is not direction-aware — a positive `left` always moves the viewport rightwards — so
 * the sign has to come from the element's computed direction. Getting this wrong scrolls AWAY from
 * the content in `ar`, which looks like a dead button.
 */
describe('useCategoryNavScroll — which way the buttons actually move', () => {
  it.each([
    ['ltr', 'forward', 300],
    ['ltr', 'back', -300],
    ['rtl', 'forward', -300],
    ['rtl', 'back', 300],
  ] as const)('dir=%s, %s → scrollBy left:%d', async (direction, button, expected) => {
    const el = makeScroller(direction);
    const { result } = await attach(el);

    act(() => result.current.scroll(button));

    expect(el.scrollBy).toHaveBeenCalledWith({ left: expected, behavior: 'smooth' });
  });
});
