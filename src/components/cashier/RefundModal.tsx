'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { OrderDto } from '@/types/order';
import { refundSchema } from '@/schemas/refund.schema';
import { isHeldByGateway } from '@/utils/tenderCustody';
import RefundModalFields, { RefundModalFieldErrors } from './RefundModalFields';
import styles from './RefundModal.module.css';

interface RefundModalProps {
  readonly order: OrderDto | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (paymentId: string, amount: number, reason: string) => Promise<void>;
  readonly isLoading?: boolean;
}

type RefundType = 'full' | 'partial';

/** Cashier refund form. BaseModal owns focus and prevents dismissal while the mutation is pending. */
export default function RefundModal({ order, isOpen, onClose, onConfirm, isLoading = false }: RefundModalProps) {
  const { t } = useTranslation();
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundType, setRefundType] = useState<RefundType>('full');
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<RefundModalFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const completedPayments = order?.payments?.filter((payment) => payment.status === 'Completed') ?? [];
  const gatewayHeldPayments = completedPayments.filter(isHeldByGateway);
  const refundablePayments = completedPayments.filter((payment) => !isHeldByGateway(payment));
  const selectedPayment = refundablePayments.find((payment) => payment.id === selectedPaymentId);
  const maxRefundAmount = selectedPayment?.amount ?? 0;

  const clearErrors = useCallback(() => {
    setFieldErrors({});
    setSubmitError(null);
  }, []);

  const handlePaymentSelect = useCallback((paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setRefundAmount('');
    setRefundType('full');
    setFieldErrors({});
    setSubmitError(null);
  }, []);

  const handleAmountChange = useCallback(
    (value: string) => {
      if (value === '' || Number.isFinite(Number.parseFloat(value))) {
        setRefundAmount(value);
        clearErrors();
      }
    },
    [clearErrors],
  );

  const handleSetMaxAmount = useCallback(() => {
    setRefundAmount(maxRefundAmount.toFixed(2));
    clearErrors();
  }, [clearErrors, maxRefundAmount]);

  const handleRefundTypeChange = useCallback(
    (type: RefundType) => {
      setRefundType(type);
      setRefundAmount(type === 'full' ? maxRefundAmount.toFixed(2) : '');
      clearErrors();
    },
    [clearErrors, maxRefundAmount],
  );

  const handleReasonChange = useCallback((value: string) => {
    setReason(value);
    setFieldErrors((current) => ({ ...current, reason: undefined }));
    setSubmitError(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    const parsed = refundSchema(maxRefundAmount).safeParse({
      paymentId: selectedPaymentId,
      refundType,
      refundAmount: refundAmount || (refundType === 'full' ? maxRefundAmount.toFixed(2) : ''),
      reason,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue.path[0];
      if (field === 'paymentId' || field === 'refundAmount' || field === 'reason') {
        setFieldErrors({ [field]: issue.message });
      } else {
        setSubmitError(issue.message);
      }
      return;
    }

    const amount = parsed.data.refundType === 'full' ? maxRefundAmount : Number(parsed.data.refundAmount);
    try {
      await onConfirm(parsed.data.paymentId, amount, parsed.data.reason);
      setSelectedPaymentId('');
      setRefundAmount('');
      setRefundType('full');
      setReason('');
      setFieldErrors({});
      setSubmitError(null);
      onClose();
    } catch (error_) {
      setSubmitError(error_ instanceof Error ? error_.message : t('cashier.refund_failed'));
    }
  }, [maxRefundAmount, onClose, onConfirm, reason, refundAmount, refundType, selectedPaymentId, t]);

  const handleClose = useCallback(() => {
    if (!isLoading) onClose();
  }, [isLoading, onClose]);

  const translateError = (error?: string) => {
    if (!error) return undefined;
    if (error === 'cashier.refund_exceeds_payment') return t(error, { max: maxRefundAmount.toFixed(2) });
    return t(error);
  };

  if (!order) return null;

  const footer = (
    <>
      <button type="button" className={styles.cancelButton} onClick={handleClose} disabled={isLoading}>
        {t('common.cancel')}
      </button>
      {refundablePayments.length > 0 && (
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleConfirm}
          disabled={!selectedPaymentId || isLoading}
        >
          {isLoading ? t('common.loading') : t('cashier.process_refund')}
        </button>
      )}
    </>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('cashier.refund_payment')}
      footer={footer}
      isPending={isLoading}
      disableBackdropClose={isLoading}
      disableEscapeClose={isLoading}
    >
      <RefundModalFields
        refundablePayments={refundablePayments}
        gatewayHeldPayments={gatewayHeldPayments}
        selectedPaymentId={selectedPaymentId}
        refundType={refundType}
        refundAmount={refundAmount}
        reason={reason}
        maxRefundAmount={maxRefundAmount}
        errors={{
          paymentId: translateError(fieldErrors.paymentId),
          refundAmount: translateError(fieldErrors.refundAmount),
          reason: translateError(fieldErrors.reason),
        }}
        isLoading={isLoading}
        onPaymentSelect={handlePaymentSelect}
        onRefundTypeChange={handleRefundTypeChange}
        onAmountChange={handleAmountChange}
        onSetMaxAmount={handleSetMaxAmount}
        onReasonChange={handleReasonChange}
      />
      {submitError && (
        <p className={styles.submitError} role="alert">
          {submitError}
        </p>
      )}
    </BaseModal>
  );
}
