import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  pendingResolutionFixture,
  resolutionIds,
  resolutionResultFixture,
} from '@/lib/__fixtures__/amendmentResolution';
import AmendmentResolutionModal from './AmendmentResolutionModal';

const mockFlow = jest.fn();
const mockContext = jest.fn();
const mockBaseModal = jest.fn();
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }) }));
jest.mock('@/components/design-system/BaseModal', () => ({
  __esModule: true,
  default: ({ children, isPending }: { children: ReactNode; isPending: boolean }) => {
    mockBaseModal(isPending);
    return <section>{children}</section>;
  },
}));
jest.mock('@/hooks/orderAmendments/useAmendmentResolution', () => ({
  useAmendmentResolution: (...args: unknown[]) => mockFlow(...args),
}));
jest.mock('@/hooks/orderAmendments/useAmendmentResolutionContext', () => ({
  useAmendmentResolutionContext: (...args: unknown[]) => mockContext(...args),
}));

const pending = pendingResolutionFixture();
const manualQuote = {
  ...pending.reviewedQuote,
  refundLegs: pending.reviewedQuote.refundLegs.map((leg) => ({
    ...leg,
    paymentMethod: 'Cash' as const,
    custody: 'ManualTill' as const,
    requiresTillConfirmation: true,
  })),
};
const manualResult = {
  ...resolutionResultFixture(),
  state: 'Processing' as const,
  resolvedAt: null,
  refundLegs: [
    {
      paymentId: resolutionIds.payment,
      custody: 'ManualTill' as const,
      state: 'Pending' as const,
      amountMinor: 400,
      resolvedAt: null,
      tillConfirmation: null,
    },
  ],
};
const props = {
  actorId: resolutionIds.actor,
  orderId: resolutionIds.order,
  amendmentId: resolutionIds.amendment,
  enabled: true,
  onChanged: jest.fn(),
  onClose: jest.fn(),
};
const state = (override: Record<string, unknown> = {}) => ({
  stage: 'pending',
  hasPending: true,
  hasPendingTillConfirmation: false,
  reviewedQuote: manualQuote,
  result: manualResult,
  check: jest.fn(),
  retry: jest.fn(),
  review: jest.fn(),
  settle: jest.fn(),
  confirmTill: jest.fn(),
  retryTill: jest.fn(),
  refreshRefused: jest.fn(),
  ...override,
});

describe('accepted manual refund sequencing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContext.mockReturnValue({
      context: {
        orderId: resolutionIds.order,
        amendmentId: resolutionIds.amendment,
        expectedOrderVersion: 1,
        expectedAccountRevision: null,
        currency: 'CHF',
        creditMinor: 400,
        earningRetirementRequired: false,
        manualRefundCandidates: [],
      },
      loading: false,
      failed: false,
      refresh: jest.fn(),
    });
  });
  it('requests only authorization during the initial review, before an operation is accepted', async () => {
    const settle = jest.fn();
    mockFlow.mockReturnValue(
      state({
        stage: 'review',
        hasPending: false,
        reviewedQuote: undefined,
        result: undefined,
        quote: manualQuote,
        settle,
      }),
    );
    render(<AmendmentResolutionModal {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('orderAmendments.resolution_manual_after_start')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm' }));
    await waitFor(() =>
      expect(screen.getByText('orderAmendments.resolution_acknowledgement_required')).toBeInTheDocument(),
    );
    expect(settle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'orderAmendments.resolution_acknowledge' }));
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm' }));
    await waitFor(() => expect(settle).toHaveBeenCalledWith());
  });
  it('requires explicit retirement before showing the refund review form', async () => {
    const prepareEarningRetirement = jest.fn();
    mockFlow.mockReturnValue(
      state({
        stage: 'idle',
        hasPending: false,
        reviewedQuote: undefined,
        result: undefined,
      }),
    );
    mockContext.mockReturnValue({
      context: { earningRetirementRequired: true },
      loading: false,
      failed: false,
      retiring: false,
      retirementFailed: false,
      refresh: jest.fn(),
      prepareEarningRetirement,
    });

    render(<AmendmentResolutionModal {...props} />);

    expect(mockContext).toHaveBeenCalledWith(expect.objectContaining({ onPrepared: props.onChanged }));
    expect(screen.getByText('orderAmendments.resolution_earning_retirement_required')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'orderAmendments.resolution_review' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_prepare_earning_retirement' }));
    expect(prepareEarningRetirement).toHaveBeenCalledTimes(1);
  });

  it('blocks an existing quote while fresh context still requires earning retirement', () => {
    const settle = jest.fn();
    mockFlow.mockReturnValue(
      state({
        stage: 'review',
        hasPending: false,
        reviewedQuote: undefined,
        result: undefined,
        quote: manualQuote,
        settle,
      }),
    );
    mockContext.mockReturnValue({
      context: { earningRetirementRequired: true },
      loading: false,
      failed: false,
      retiring: false,
      retirementFailed: false,
      refresh: jest.fn(),
      prepareEarningRetirement: jest.fn(),
    });

    render(<AmendmentResolutionModal {...props} />);

    expect(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm' }));
    expect(settle).not.toHaveBeenCalled();
  });

  it('keeps the modal pending while the Admin retirement request is in flight', () => {
    mockFlow.mockReturnValue(state({ stage: 'idle', hasPending: false, reviewedQuote: undefined, result: undefined }));
    mockContext.mockReturnValue({
      context: { earningRetirementRequired: true },
      loading: false,
      failed: false,
      retiring: true,
      retirementFailed: false,
      refresh: jest.fn(),
      prepareEarningRetirement: jest.fn(),
    });

    render(<AmendmentResolutionModal {...props} />);

    expect(mockBaseModal).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: 'common.loading' })).toBeDisabled();
  });

  it('does not offer retirement when the fresh context says it is unnecessary', () => {
    mockFlow.mockReturnValue(state());
    mockContext.mockReturnValue({
      context: { earningRetirementRequired: false },
      loading: false,
      failed: false,
      retiring: false,
      retirementFailed: false,
      refresh: jest.fn(),
      prepareEarningRetirement: jest.fn(),
    });

    render(<AmendmentResolutionModal {...props} />);

    expect(
      screen.queryByRole('button', { name: 'orderAmendments.resolution_prepare_earning_retirement' }),
    ).not.toBeInTheDocument();
  });
  it('confirms a frozen manual leg after acceptance even with new reviews disabled', async () => {
    const confirmTill = jest.fn();
    mockFlow.mockReturnValue(state({ confirmTill }));
    render(<AmendmentResolutionModal {...props} enabled={false} />);
    expect(screen.queryByRole('button', { name: 'orderAmendments.resolution_review' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'till/refund-42' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'orderAmendments.resolution_acknowledge_till' }));
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm_till' }));
    await waitFor(() =>
      expect(confirmTill).toHaveBeenCalledWith([{ paymentId: resolutionIds.payment, tillReference: 'till/refund-42' }]),
    );
  });
  it('requires and submits the explicitly confirmed zero physical cash return', async () => {
    const confirmTill = jest.fn();
    const cashRefund = {
      policyVersion: 'chf-cash-5-rappen-v1' as const,
      originalExactAmountMinor: 335,
      originalDueAmountMinor: 335,
      previouslyRefundedExactMinor: 0,
      previouslyRefundedCashMinor: 0,
      exactRefundAmountMinor: 1,
      refundAdjustmentMinor: -1,
      cashRefundAmountMinor: 0,
      retainedExactAmountMinor: 334,
      retainedCashDueMinor: 335,
    };
    const quote = {
      ...manualQuote,
      creditMinor: 333,
      refundMinor: 1,
      unpaidWaivedMinor: 332,
      refundLegs: [{ ...manualQuote.refundLegs[0], amountMinor: 1, cashRefund }],
    };
    const result = {
      ...manualResult,
      creditMinor: 333,
      refundMinor: 1,
      unpaidWaivedMinor: 332,
      refundLegs: [{ ...manualResult.refundLegs[0], amountMinor: 1, cashRefund }],
    };
    mockFlow.mockReturnValue(state({ reviewedQuote: quote, result, confirmTill }));
    render(<AmendmentResolutionModal {...props} enabled={false} />);
    expect(screen.getByText('orderAmendments.resolution_cash_exact_refund')).toBeInTheDocument();
    const adjustment = screen.getByText('orderAmendments.resolution_cash_refund_adjustment');
    expect(adjustment.closest('div')).toHaveTextContent('−');
    const cashReturn = screen.getByRole('checkbox', { name: 'orderAmendments.resolution_cash_return_checkbox' });
    expect(cashReturn).not.toBeChecked();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'till/zero-return' } });
    fireEvent.click(cashReturn);
    fireEvent.click(screen.getByRole('checkbox', { name: 'orderAmendments.resolution_acknowledge_till' }));
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_confirm_till' }));
    await waitFor(() =>
      expect(confirmTill).toHaveBeenCalledWith([
        { paymentId: resolutionIds.payment, tillReference: 'till/zero-return', cashReturnedMinor: 0 },
      ]),
    );
  });
  it('offers exact saved confirmation retry without asking staff to refund or re-enter references again', () => {
    const retryTill = jest.fn();
    mockFlow.mockReturnValue(state({ hasPendingTillConfirmation: true, retryTill }));
    render(<AmendmentResolutionModal {...props} enabled={false} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText('orderAmendments.resolution_till_help')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'orderAmendments.resolution_retry_till' }));
    expect(retryTill).toHaveBeenCalledWith();
  });
  it('holds manual actions after a lost lookup response until the accepted result is read again', () => {
    mockFlow.mockReturnValue(state({ result: undefined }));
    render(<AmendmentResolutionModal {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'orderAmendments.check_operation' })).toBeInTheDocument();
  });
  it('does not offer a physical refund for a leg already confirmed by server readback', () => {
    mockFlow.mockReturnValue(
      state({
        result: {
          ...manualResult,
          refundLegs: [
            {
              ...manualResult.refundLegs[0],
              state: 'Succeeded',
              resolvedAt: '2026-10-03T16:05:00Z',
              tillConfirmation: { tillReference: 'already-returned', confirmedAt: '2026-10-03T16:05:00Z' },
            },
          ],
        },
      }),
    );
    render(<AmendmentResolutionModal {...props} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'orderAmendments.resolution_confirm_till' })).not.toBeInTheDocument();
  });
});
