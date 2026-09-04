import React from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import FormField from '@/components/design-system/FormField';

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
 *
 * Label, input and error composition is `FormField`'s (CLAUDE.md frontend §5 rule 3), not this
 * component's: it is what ties the message to the field it describes through `aria-describedby` and
 * `aria-invalid`. An earlier version of this file re-implemented that markup by hand and got the
 * accessibility relationship wrong for free — the two surrounding modals still hand-roll theirs,
 * which is a separate debt this does not widen.
 */
export interface MoneyFieldProps {
  readonly id: string;
  readonly label: string;
  /** The result of `register(name, emptyAsNull)` — the caller owns the field name, not the rule. */
  readonly registration: UseFormRegisterReturn;
  /** Already-translated message, or nothing. */
  readonly error?: string;
}

export default function MoneyField({ id, label, registration, error }: MoneyFieldProps) {
  return (
    <FormField label={label} error={error} htmlFor={id}>
      <input type="number" step="0.01" id={id} {...registration} />
    </FormField>
  );
}
