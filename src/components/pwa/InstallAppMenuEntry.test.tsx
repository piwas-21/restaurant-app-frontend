import '@testing-library/jest-dom';
import { act, render, screen, fireEvent } from '@testing-library/react';
import InstallAppMenuEntry from './InstallAppMenuEntry';
import type { InstallPlatform } from '@/hooks/usePwaInstall';

/**
 * `t` echoes the key so the assertions pin WHICH key renders, not a translation that could
 * drift under the assertion.
 */
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockHook: {
  platform: InstallPlatform;
  canPrompt: boolean;
  promptInstall: jest.Mock;
  standalone: boolean;
} = {
  platform: 'chromium',
  canPrompt: true,
  promptInstall: jest.fn().mockResolvedValue('accepted'),
  standalone: false,
};

jest.mock('@/hooks/usePwaInstall', () => ({
  usePwaInstall: () => mockHook,
}));

// The iOS instruction sheet is a modal with its own tests; here only its OPEN state matters.
jest.mock('./PwaIosInstallModal', () => ({
  __esModule: true,
  default: (props: { isOpen: boolean }) => (props.isOpen ? <div data-testid="ios-modal" /> : null),
}));

describe('InstallAppMenuEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHook.platform = 'chromium';
    mockHook.canPrompt = true;
    mockHook.standalone = false;
  });

  it('renders the fixed nav item on chromium and prompts on click', async () => {
    const onActivate = jest.fn();
    render(<InstallAppMenuEntry onActivate={onActivate} />);

    fireEvent.click(screen.getByRole('button', { name: 'nav_install_app' }));
    await act(async () => {});

    expect(mockHook.promptInstall).toHaveBeenCalledTimes(1);
    expect(onActivate).toHaveBeenCalled();
  });

  it('opens the instruction sheet on iOS instead of a native prompt', async () => {
    mockHook.platform = 'ios';
    mockHook.canPrompt = false;
    const onActivate = jest.fn();
    render(<InstallAppMenuEntry onActivate={onActivate} />);

    fireEvent.click(screen.getByRole('button', { name: 'nav_install_app' }));
    await act(async () => {});

    expect(mockHook.promptInstall).not.toHaveBeenCalled();
    expect(screen.getByTestId('ios-modal')).toBeInTheDocument();
    expect(onActivate).toHaveBeenCalled();
  });

  it('hides itself once the app is installed (standalone)', () => {
    mockHook.standalone = true;
    const { container } = render(<InstallAppMenuEntry />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides itself where no install can be offered', () => {
    mockHook.platform = 'unsupported';
    mockHook.canPrompt = false;
    const { container } = render(<InstallAppMenuEntry />);
    expect(container).toBeEmptyDOMElement();
  });
});
