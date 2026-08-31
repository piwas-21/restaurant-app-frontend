import '@testing-library/jest-dom';
import { act, render, screen, fireEvent } from '@testing-library/react';
import en from '@/locales/en.json';
import PwaInstallPrompt from './PwaInstallPrompt';
import type { InstallPromptVariant } from '@/hooks/usePwaInstallPrompt';

/**
 * `t` resolves against the REAL en bundle rather than echoing the key, so these assertions read the
 * string a guest sees. A missing key would render `undefined` here and fail loudly, which is the
 * same defect `scripts/check-t-keys.mjs` guards at the callsite level.
 */
const mockStrings = en as unknown as Record<string, string>;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => mockStrings[key] ?? key }),
}));

const mockHook: { variant: InstallPromptVariant; install: jest.Mock; dismiss: jest.Mock } = {
  variant: 'android',
  install: jest.fn(),
  dismiss: jest.fn(),
};

jest.mock('@/hooks/usePwaInstallPrompt', () => ({
  usePwaInstallPrompt: () => mockHook,
}));

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHook.variant = 'android';
  });

  it('renders nothing when the hook says there is nothing to offer', () => {
    mockHook.variant = 'none';
    const { container } = render(<PwaInstallPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers a real install button on android', () => {
    render(<PwaInstallPrompt />);
    expect(screen.getByText(mockStrings.pwa_install_title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_action }));
    expect(mockHook.install).toHaveBeenCalledTimes(1);
  });

  it('remembers a dismissal through the hook', () => {
    render(<PwaInstallPrompt />);
    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_dismiss }));
    expect(mockHook.dismiss).toHaveBeenCalledTimes(1);
  });

  it('opens the NATIVE share sheet from the iOS button — the closest iOS gets to one tap', async () => {
    // Apple exposes no install API on iOS; the Web Share API opening the system sheet is
    // the whole reduction: our button, then "Add to Home Screen" in Apple's own menu.
    const share = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    // A real programmatic-install button would be a lie on iOS; the label is the action.
    expect(screen.queryByRole('button', { name: mockStrings.pwa_install_action })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_ios_action }));
    await act(async () => {});
    expect(share).toHaveBeenCalledTimes(1);
    expect(share.mock.calls[0][0]).toMatchObject({ url: window.location.href });
    // Finishing with Apple's sheet counts as a decision — honoured for 30 days.
    expect(mockHook.dismiss).toHaveBeenCalledTimes(1);
    delete (window.navigator as { share?: unknown }).share;
  });

  it('treats a cancelled share sheet as a no', async () => {
    const share = jest.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    Object.defineProperty(window.navigator, 'share', { value: share, configurable: true });
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_ios_action }));
    await act(async () => {});
    expect(mockHook.dismiss).toHaveBeenCalledTimes(1);
    delete (window.navigator as { share?: unknown }).share;
  });

  it('falls back to the manual-step sheet when the Web Share API is missing', async () => {
    // A browser without navigator.share cannot open the sheet — the honest fallback is
    // the walk-through, exactly as before.
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_ios_action }));
    await act(async () => {});
    expect(screen.getByText(mockStrings.pwa_install_ios_step_share)).toBeInTheDocument();
    expect(screen.getByText(mockStrings.pwa_install_ios_step_add)).toBeInTheDocument();
  });

  it('does not open the iOS sheet unasked', () => {
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    expect(screen.queryByText(mockStrings.pwa_install_ios_step_share)).not.toBeInTheDocument();
  });
});
