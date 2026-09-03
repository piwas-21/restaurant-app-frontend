import { act, renderHook } from '@testing-library/react';
import { usePwaInstall, type BeforeInstallPromptEvent } from './usePwaInstall';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/**
 * jsdom has no matchMedia; every test declares what the "device" answers.
 *
 * `handheld` defaults to TRUE because that is the device every existing case here is about — a
 * phone or a tablet. Passing `false` is how the desktop case says so, and the offer is now gated on
 * it: Chromium fires `beforeinstallprompt` on a laptop too, and the nav entry appeared there.
 */
function mockMatchMedia({ standalone = false, handheld = true }: { standalone?: boolean; handheld?: boolean } = {}) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('display-mode')
      ? standalone
      : query.includes('pointer: coarse') || query.includes('max-width: 1024px')
        ? handheld
        : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    onchange: null,
    dispatchEvent: jest.fn(),
  }));
}

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt') as BeforeInstallPromptEvent;
  event.prompt = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' as const }) });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('usePwaInstall', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__pwaDeferredInstall;
    setUserAgent(ANDROID_CHROME);
    mockMatchMedia({});
  });

  it('sees an event captured BEFORE the hook mounted — the repeat-visitor race is dead', () => {
    // The module-scope listener registered at import parks the event; the hook picks it up.
    fireBeforeInstallPrompt();

    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.platform).toBe('chromium');
    expect(result.current.canPrompt).toBe(true);
  });

  it('promptInstall consumes the parked event and reports the outcome', async () => {
    const event = fireBeforeInstallPrompt();
    const { result } = renderHook(() => usePwaInstall());

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(outcome).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(window.__pwaDeferredInstall).toBeUndefined();
  });

  it('reports ios for an iPhone without needing any event', () => {
    setUserAgent(IPHONE_SAFARI);
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.platform).toBe('ios');
    expect(result.current.canPrompt).toBe(false);
  });

  it('reports unsupported on a desktop browser with no install event', () => {
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.platform).toBe('unsupported');
  });

  it('reports unsupported everywhere once the app runs standalone', () => {
    mockMatchMedia({ standalone: true });
    fireBeforeInstallPrompt();
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.standalone).toBe(true);
    expect(result.current.platform).toBe('unsupported');
  });

  /**
   * The reported defect: Chromium fires `beforeinstallprompt` on a desktop, so the nav entry
   * appeared on a laptop and offered to install a restaurant's ordering app as a desktop window.
   */
  it('offers nothing on a desktop, even with the install event in hand', () => {
    mockMatchMedia({ handheld: false });
    setUserAgent(ANDROID_CHROME);
    const { result } = renderHook(() => usePwaInstall());
    fireBeforeInstallPrompt();

    expect(result.current.platform).toBe('unsupported');
    expect(result.current.canPrompt).toBe(false);
  });

  /** A touchscreen LAPTOP answers `pointer: coarse` and is still a desktop — both bounds required. */
  it('offers nothing on a coarse-pointer device that is desktop-wide', () => {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      onchange: null,
      dispatchEvent: jest.fn(),
    }));
    setUserAgent(ANDROID_CHROME);
    const { result } = renderHook(() => usePwaInstall());
    fireBeforeInstallPrompt();

    expect(result.current.platform).toBe('unsupported');
  });

  /** …and an iPhone gets nothing on a desktop-width window either, though it never has one. */
  it('gates iOS on the same bound', () => {
    mockMatchMedia({ handheld: false });
    setUserAgent(IPHONE_SAFARI);
    const { result } = renderHook(() => usePwaInstall());

    expect(result.current.platform).toBe('unsupported');
  });
});
