import { act, render, screen } from '@testing-library/react';
import PreparationCountdown from './PreparationCountdown';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-GB' },
    t: (key: string, fallback: string, options?: { minutes?: number; time?: string }) => {
      const copy: Record<string, string> = {
        'orders.preparation_estimate': 'Preparation estimate: {{minutes}} min',
        'orders.expected_ready_now': 'Estimated preparation time has elapsed. Awaiting a restaurant update.',
        'orders.expected_ready_in': 'Expected ready in {{minutes}} min',
        'orders.expected_ready_at': '(at {{time}})',
      };
      return (copy[key] ?? fallback)
        .replace('{{minutes}}', String(options?.minutes ?? ''))
        .replace('{{time}}', String(options?.time ?? ''));
    },
  }),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-15T10:00:00.000Z'));
});

afterEach(() => jest.useRealTimers());

it('keeps pending approval ETA hidden and starts a timezone-aware countdown after acceptance', () => {
  const props = {
    status: 'PendingApproval',
    effectivePreparationMinutes: 20,
    expectedReadyAt: '2026-10-15T10:02:00.000Z',
    timeZone: 'Europe/Zurich',
  };
  const { rerender } = render(<PreparationCountdown {...props} />);
  expect(screen.queryByText(/Expected ready/)).not.toBeInTheDocument();

  rerender(<PreparationCountdown {...props} status="Preparing" />);
  expect(screen.getByText('Expected ready in 2 min')).toBeInTheDocument();
  expect(screen.getByText('(at 12:02)')).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(2 * 60 * 1000));
  expect(screen.getByText('Estimated preparation time has elapsed. Awaiting a restaurant update.')).toBeInTheDocument();
  rerender(<PreparationCountdown {...props} status="Ready" />);
  expect(screen.queryByText(/Estimated preparation time/)).not.toBeInTheDocument();
});

it('shows a known preparation estimate when acceptance has no expected-ready timestamp', () => {
  render(<PreparationCountdown status="Confirmed" effectivePreparationMinutes={15} />);
  expect(screen.getByText('Preparation estimate: 15 min')).toBeInTheDocument();
});

it('shows an explicit zero-minute override while keeping a missing duration hidden', () => {
  const { rerender } = render(<PreparationCountdown status="Confirmed" effectivePreparationMinutes={0} />);
  expect(screen.getByText('Preparation estimate: 0 min')).toBeInTheDocument();

  rerender(<PreparationCountdown status="Confirmed" effectivePreparationMinutes={null} />);
  expect(screen.queryByText(/Preparation estimate/)).not.toBeInTheDocument();
});

it('does not guess the venue time from the guest device timezone', () => {
  render(<PreparationCountdown status="Preparing" expectedReadyAt="2026-10-15T10:02:00.000Z" />);

  expect(screen.getByText('Expected ready in 2 min')).toBeInTheDocument();
  expect(screen.queryByText(/\(at /)).not.toBeInTheDocument();
});

it('omits only the formatted business time when the timezone is invalid', () => {
  render(
    <PreparationCountdown status="Preparing" expectedReadyAt="2026-10-15T10:02:00.000Z" timeZone="Invalid/Zone" />,
  );

  expect(screen.getByText('Expected ready in 2 min')).toBeInTheDocument();
  expect(screen.queryByText(/\(at /)).not.toBeInTheDocument();
});
