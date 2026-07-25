import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import CancelSuccessModal from './CancelSuccessModal';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('CancelSuccessModal', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders nothing while closed (BaseModal evaluates children even then)', () => {
    render(<CancelSuccessModal isOpen={false} onClose={jest.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the success message and Close actions when open', () => {
    render(<CancelSuccessModal isOpen onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Reservation cancelled successfully' })).toBeInTheDocument();
    expect(screen.getByText(/has been cancelled/)).toBeInTheDocument();
    // The BaseModal X (aria-label) plus the footer button both read "Close".
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('auto-closes after the default 3 seconds (migration keeps the timer)', () => {
    const onClose = jest.fn();
    render(<CancelSuccessModal isOpen onClose={onClose} />);
    act(() => jest.advanceTimersByTime(2999));
    expect(onClose).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not arm the timer while closed', () => {
    const onClose = jest.fn();
    render(<CancelSuccessModal isOpen={false} onClose={onClose} />);
    act(() => jest.advanceTimersByTime(10_000));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('never auto-closes when autoCloseMs is 0', () => {
    const onClose = jest.fn();
    render(<CancelSuccessModal isOpen onClose={onClose} autoCloseMs={0} />);
    act(() => jest.advanceTimersByTime(10_000));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes immediately via the footer button', () => {
    const onClose = jest.fn();
    render(<CancelSuccessModal isOpen onClose={onClose} />);
    const buttons = screen.getAllByRole('button', { name: 'Close' });
    fireEvent.click(buttons[buttons.length - 1]); // footer button (X comes first)
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
