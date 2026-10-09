'use client';

import TipSelector from '@/components/checkout/TipSelector';

interface Props {
  readonly basketId?: string;
  readonly subtotal: number;
  readonly selectedTipAmount: number;
  readonly onTipChange: (amount: number) => void;
  readonly onValidityChange: (valid: boolean) => void;
  readonly locale: string;
  readonly disabled: boolean;
  readonly styles: Readonly<Record<string, string>>;
}

export default function CheckoutReviewTipSelector({
  basketId,
  subtotal,
  selectedTipAmount,
  onTipChange,
  onValidityChange,
  locale,
  disabled,
  styles,
}: Readonly<Props>) {
  return (
    <TipSelector
      key={basketId ?? 'no-basket'}
      subtotal={subtotal}
      selectedTipAmount={selectedTipAmount}
      onTipChange={onTipChange}
      onValidityChange={onValidityChange}
      locale={locale}
      disabled={disabled}
      styles={styles}
    />
  );
}
