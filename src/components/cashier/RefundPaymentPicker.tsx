'use client';

import { useTranslation } from 'react-i18next';
import { OrderPaymentDto } from '@/types/order';
import { getPaymentMethodLabel } from '@/utils/paymentMethodDisplay';
import { gatewayNames } from '@/utils/tenderCustody';

interface RefundPaymentPickerProps {
  refundable: OrderPaymentDto[];
  gatewayHeld: OrderPaymentDto[];
  selectedPaymentId: string;
  onSelect: (paymentId: string) => void;
  isLoading: boolean;
}

/**
 * The "which payment are we refunding" half of {@link RefundDialog}: the selectable list, plus the
 * notice explaining any tender that is deliberately absent from it.
 *
 * Extracted so the dialog stays inside its file-length limit, and because the notice has to render
 * in BOTH of the dialog's states — beside a list, and in place of one when every tender on the
 * order was taken online. That second case is the one worth getting right: without the notice it
 * reads "No refundable payments available for this order", which tells a cashier looking at a paid
 * order that the money does not exist.
 */
export default function RefundPaymentPicker({
  refundable,
  gatewayHeld,
  selectedPaymentId,
  onSelect,
  isLoading,
}: Readonly<RefundPaymentPickerProps>) {
  const { t } = useTranslation();
  const gateways = gatewayNames(gatewayHeld);

  return (
    <>
      {gateways.length > 0 && (
        <div className="alert alert-info">{t('gateway_refund_notice', { gateway: gateways.join(', ') })}</div>
      )}

      {refundable.length === 0 ? (
        // Only when there is nothing to say about a gateway either — otherwise the notice above
        // has already explained the empty list, and this sentence would contradict it.
        gateways.length === 0 && <div className="alert alert-info">{t('cashier.no_refundable_payments')}</div>
      ) : (
        // No `t(…) || 'English'` fallbacks, unlike the code this moved out of. `t()` returns the
        // KEY when a key is missing, and a key is a non-empty string, so the right-hand side can
        // never run — the same dead branch #417 removed two of from RefundDialog. Both keys here
        // resolve in all ten locales.
        <div className="form-group">
          <label className="form-label">{t('cashier.select_payment')} *</label>
          <div className="payment-options">
            {refundable.map((payment) => (
              <button
                key={payment.id}
                // Explicit, and not cosmetic: a <button> with no type defaults to `submit`. These
                // sit in a modal today, but the dialog they came out of is one wrapper away from a
                // <form>, and there "pick which payment to refund" would submit it.
                type="button"
                className={`payment-option ${selectedPaymentId === payment.id ? 'selected' : ''}`}
                onClick={() => onSelect(payment.id)}
                disabled={isLoading}
              >
                <div className="payment-info">
                  <span className="payment-method">{getPaymentMethodLabel(payment.paymentMethod)}</span>
                  <span className="payment-amount">{(payment.amount || 0).toFixed(2)}</span>
                </div>
                <span className="payment-date">{new Date(payment.paymentDate || '').toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
