import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('shows instructions instead of an install button on iOS', () => {
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    // There is no programmatic install on iOS — offering an "Install" button would be a lie.
    expect(screen.queryByRole('button', { name: mockStrings.pwa_install_action })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: mockStrings.pwa_install_ios_action }));
    expect(screen.getByText(mockStrings.pwa_install_ios_step_share)).toBeInTheDocument();
    expect(screen.getByText(mockStrings.pwa_install_ios_step_add)).toBeInTheDocument();
  });

  it('does not open the iOS sheet unasked', () => {
    mockHook.variant = 'ios';
    render(<PwaInstallPrompt />);
    expect(screen.queryByText(mockStrings.pwa_install_ios_step_share)).not.toBeInTheDocument();
  });
});
