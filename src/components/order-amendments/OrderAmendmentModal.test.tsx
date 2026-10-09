import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import OrderAmendmentModal from './OrderAmendmentModal';

const mockUseAmendment = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key, i18n: { language: 'en' } }),
}));
jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <section>
      {children}
      {footer}
    </section>
  ),
}));
jest.mock('@/hooks/orderAmendments/useOrderAmendment', () => ({
  useOrderAmendment: (...args: unknown[]) => mockUseAmendment(...args),
}));
jest.mock('./OrderAmendmentEditStage', () => ({
  __esModule: true,
  default: ({
    draft,
    onDraftChange,
  }: {
    draft: OrderAmendmentDraft;
    onDraftChange: (draft: OrderAmendmentDraft) => void;
  }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onDraftChange({
            ...draft,
            changes: [{ orderItemId: 'root-line', kind: 'Void', startOrdinal: 1, quantity: 1 }],
            reason: 'Guest correction',
          })
        }
      >
        Make correction
      </button>
      <label>
        <input
          type="checkbox"
          aria-label="Kitchen override acknowledgement"
          checked={draft.preparingOverrideAcknowledged}
          onChange={(event) => onDraftChange({ ...draft, preparingOverrideAcknowledged: event.target.checked })}
        />
        Acknowledge kitchen correction
      </label>
    </div>
  ),
}));
jest.mock('./OrderAmendmentReviewStage', () => ({ __esModule: true, default: () => null }));

const order = {
  id: 'order-1',
  orderNumber: 'A-001',
  type: 'DineIn',
  status: 'Preparing',
  paymentStatus: 'Paid',
  version: 4,
  items: [],
} as unknown as OrderDto;

const hookState = (overrides: Record<string, unknown> = {}) => ({
  phase: 'editing',
  quote: null,
  result: null,
  clientOperationId: null,
  commitRequest: null,
  operationLookup: null,
  error: null,
  recoveryReady: true,
  canRetrySameCommit: false,
  canRequote: false,
  prepareQuote: jest.fn(),
  commit: jest.fn(),
  checkOperation: jest.fn(),
  retrySameCommit: jest.fn(),
  reset: jest.fn(),
  ...overrides,
});

describe('OrderAmendmentModal', () => {
  beforeEach(() => mockUseAmendment.mockReturnValue(hookState()));

  it.each(['Server', 'Cashier', 'Admin'] as const)(
    'keeps quote and confirmation separate and requires kitchen acknowledgement for %s',
    (operatorRole) => {
      render(<OrderAmendmentModal order={order} operatorRole={operatorRole} onClose={jest.fn()} />);
      const quoteButton = screen.getByRole('button', { name: 'Get a quote' });
      expect(quoteButton).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Make correction' }));
      const acknowledgement = screen.getByRole('checkbox', { name: 'Kitchen override acknowledgement' });
      expect(quoteButton).toBeDisabled();
      fireEvent.click(acknowledgement);
      expect(quoteButton).toBeEnabled();
    },
  );

  it('only returns an expired, verified-unknown operation to edits for a fresh quote', () => {
    const reset = jest.fn();
    mockUseAmendment.mockReturnValue(
      hookState({
        phase: 'uncertain',
        quote: { expiresAt: '2020-01-01T00:00:00Z' },
        operationLookup: { status: 'Unknown' },
        canRequote: true,
        reset,
      }),
    );
    const { rerender } = render(<OrderAmendmentModal order={order} operatorRole="Cashier" onClose={jest.fn()} />);
    const returnButton = screen.getByRole('button', { name: 'Return to edits and request a new quote' });
    fireEvent.click(returnButton);
    expect(reset).toHaveBeenCalledTimes(1);

    mockUseAmendment.mockReturnValue(
      hookState({ phase: 'uncertain', quote: null, operationExpiresAt: '2020-01-01T00:00:00Z' }),
    );
    rerender(<OrderAmendmentModal order={order} operatorRole="Cashier" onClose={jest.fn()} />);
    expect(screen.queryByRole('button', { name: 'Return to edits and request a new quote' })).not.toBeInTheDocument();
  });

  it('keeps flag-off recovery read-only while allowing lookup and close', () => {
    const onClose = jest.fn();
    const checkOperation = jest.fn();
    const prepareQuote = jest.fn();
    const commit = jest.fn();
    const retrySameCommit = jest.fn();
    const reset = jest.fn();
    mockUseAmendment.mockReturnValue(
      hookState({
        phase: 'uncertain',
        operationLookup: { operationId: 'operation-1', status: 'Unknown' },
        canRetrySameCommit: true,
        canRequote: true,
        checkOperation,
        prepareQuote,
        commit,
        retrySameCommit,
        reset,
      }),
    );

    render(<OrderAmendmentModal order={order} operatorRole="Server" recoveryOnly onClose={onClose} />);

    expect(screen.getByRole('button', { name: 'Check the original operation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get a quote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm amendment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry with the same operation ID' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return to edits and request a new quote' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Check the original operation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(checkOperation).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(prepareQuote).not.toHaveBeenCalled();
    expect(commit).not.toHaveBeenCalled();
    expect(retrySameCommit).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it('shows a confirmed recovery result and allows the modal to close', () => {
    const onClose = jest.fn();
    mockUseAmendment.mockReturnValue(
      hookState({
        phase: 'committed',
        result: { clientOperationId: 'operation-2' },
      }),
    );

    render(<OrderAmendmentModal order={order} operatorRole="Cashier" recoveryOnly onClose={onClose} />);

    expect(screen.getByRole('status')).toHaveTextContent(/^Amendment committed · operation-2$/);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
