import { act, renderHook } from '@testing-library/react';
import {
  MIN_VISITS,
  PWA_DISMISSED_KEY,
  PWA_INSTALLED,
  PWA_VISITS_KEY,
  REASK_AFTER_MS,
  SHOW_DELAY_MS,
  usePwaInstallPrompt,
  type BeforeInstallPromptEvent,
} from './usePwaInstallPrompt';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

/** jsdom has no matchMedia; every test declares what the "device" answers. */
function mockMatchMedia({ standalone = false, mobile = true }: { standalone?: boolean; mobile?: boolean }) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: query.includes('display-mode') ? standalone : mobile,
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

/** The browser has visited before, so the first-visit hold-back is not what a test is measuring. */
function seedReturningVisitor() {
  window.localStorage.setItem(PWA_VISITS_KEY, String(MIN_VISITS));
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

describe('usePwaInstallPrompt', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.localStorage.clear();
    setUserAgent(ANDROID_CHROME);
    mockMatchMedia({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the android banner after the delay when beforeinstallprompt fires', () => {
    seedReturningVisitor();
    const { result } = renderHook(() => usePwaInstallPrompt());

    fireBeforeInstallPrompt();
    expect(result.current.variant).toBe('none'); // still inside the quiet period

    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('android');
  });

  it('stays hidden on a first visit even when the event fires', () => {
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS * 4);
    });
    expect(result.current.variant).toBe('none');
    expect(window.localStorage.getItem(PWA_VISITS_KEY)).toBe('1');
  });

  it('stays hidden when the app is already installed (display-mode: standalone)', () => {
    seedReturningVisitor();
    mockMatchMedia({ standalone: true });
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('none');
  });

  it('stays hidden when iOS reports navigator.standalone', () => {
    seedReturningVisitor();
    setUserAgent(IPHONE_SAFARI);
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('none');
    Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true });
  });

  it('stays hidden on a desktop viewport', () => {
    seedReturningVisitor();
    mockMatchMedia({ mobile: false });
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('none');
  });

  it('shows the ios instructions variant on iPhone Safari, with no event', () => {
    seedReturningVisitor();
    setUserAgent(IPHONE_SAFARI);
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('ios');
  });

  it('shows nothing in Chrome on iOS, which cannot install at all', () => {
    seedReturningVisitor();
    setUserAgent(IPHONE_SAFARI.replace('Version/17.5', 'CriOS/126.0.0.0'));
    const { result } = renderHook(() => usePwaInstallPrompt());
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('none');
  });

  it('stays hidden while a dismissal is inside the re-ask window, and returns after it', () => {
    seedReturningVisitor();
    window.localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now() - REASK_AFTER_MS + 1000));
    const first = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(first.result.current.variant).toBe('none');

    window.localStorage.setItem(PWA_DISMISSED_KEY, String(Date.now() - REASK_AFTER_MS - 1000));
    const second = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(second.result.current.variant).toBe('android');
  });

  it('never re-asks once the app has been installed', () => {
    seedReturningVisitor();
    window.localStorage.setItem(PWA_DISMISSED_KEY, PWA_INSTALLED);
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('none');
  });

  it('remembers a dismissal as a timestamp', () => {
    seedReturningVisitor();
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.variant).toBe('none');
    expect(Number(window.localStorage.getItem(PWA_DISMISSED_KEY))).toBeGreaterThan(0);
  });

  it('calls the native prompt and records an accepted install permanently', async () => {
    seedReturningVisitor();
    const { result } = renderHook(() => usePwaInstallPrompt());
    const event = fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });

    await act(async () => {
      await result.current.install();
    });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PWA_DISMISSED_KEY)).toBe(PWA_INSTALLED);
    expect(result.current.variant).toBe('none');
  });

  it('hides and never re-asks when the browser reports appinstalled', () => {
    seedReturningVisitor();
    const { result } = renderHook(() => usePwaInstallPrompt());
    fireBeforeInstallPrompt();
    act(() => {
      jest.advanceTimersByTime(SHOW_DELAY_MS);
    });
    expect(result.current.variant).toBe('android');

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(result.current.variant).toBe('none');
    expect(window.localStorage.getItem(PWA_DISMISSED_KEY)).toBe(PWA_INSTALLED);
  });
});
