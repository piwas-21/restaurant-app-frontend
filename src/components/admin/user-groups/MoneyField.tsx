import React from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

/**
 * The min-order / max-discount pair, as ONE control (#642).
 *
 * Both modals that write a `GroupDiscount` render this pair — `DiscountModal` (edit) and
 * `UserGroupModal`'s initial-discount block (create) — and they rendered it twice, verbatim. That
 * copy is what let the two disagree in the first place: the null-to-zero defect had to be found and
 * fixed in each of them separately, and a reader of either one could not tell whether the other
 * still stored 0.
 *
 * The `emptyAsNull` registration is therefore INSIDE this component and not a prop. An empty money
 * input means "not set", never zero, and a caller that could pass its own registration is a caller
 * that can forget — which is exactly how the field got back to 0 on the create path while the edit
 * path was correct.
 */
export interface MoneyFieldProps {
  readonly id: string;
  readonly label: string;
  /** The result of `register(name, emptyAsNull)` — the caller owns the field name, not the rule. */
  readonly registration: UseFormRegisterReturn;
  /** Already-translated message, or nothing. Rendered by the caller's own error class. */
  readonly error?: string;
  readonly errorClassName: string;
  readonly groupClassName: string;
}

export default function MoneyField({
  id,
  label,
  registration,
  error,
  errorClassName,
  groupClassName,
}: MoneyFieldProps) {
  return (
    <div className={groupClassName}>
      <label htmlFor={id}>{label}</label>
      <input type="number" step="0.01" id={id} {...registration} />
      {error && <p className={errorClassName}>{error}</p>}
    </div>
  );
}
