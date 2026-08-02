'use client';

import { useTranslation } from 'react-i18next';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';
import { orderTypeLabel } from '@/utils/orderTypeLabels';
import CheckboxField from './CheckboxField';
import defaultStyles from './ChannelPicker.module.css';

export interface ChannelPickerProps {
  /** The order types currently selected. */
  selected: readonly OrderType[];
  /** Called with the type that was clicked; the host owns how the set changes. */
  onToggle: (orderType: OrderType) => void;
  disabled?: boolean;
  /** Error message for the group; also marks each box `aria-invalid`. */
  error?: string;
  /** Id for the error paragraph, so a host fieldset can reference it. */
  errorId?: string;
  /**
   * Host stylesheet for the GROUP (`group`, `error`). Omit for the design-system look.
   * `checkboxStyles` skins the individual boxes — see `CheckboxField`.
   */
  styles?: Readonly<Record<string, string>>;
  checkboxStyles?: Readonly<Record<string, string>>;
}

/**
 * The labelled order-type checkbox row — "which channels is this available on?", asked once.
 *
 * BUGS-IMPROVEMENTS-PLAN E2: the same question was written twice, with no shared component and no
 * design-system primitive between them.
 *
 * The order comes from `ALL_ORDER_TYPES` and the labels from `orderTypeLabel`, so a new channel
 * appears wherever channels are listed. It deliberately does NOT own the selection: a product
 * round-trips a nullable mask with an inherit mode, a category row round-trips a dirty-tracked
 * list, and folding either rule in here would make the other one a special case.
 *
 * ONE consumer today — the product editor's channel row. The category matrix keeps its `<table>`,
 * because three separate `<td>`s are what let a column be scanned and what gives each box a
 * `<th scope="col">`; collapsing them into one picker cell would trade a matrix for a list. It
 * shares the CHECKBOX and the label resolver, which is where the two surfaces could actually drift.
 */
export default function ChannelPicker({
  selected,
  onToggle,
  disabled,
  error,
  errorId,
  styles = defaultStyles,
  checkboxStyles,
}: Readonly<ChannelPickerProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* The description goes on each INPUT, not on this div: a plain div is `role="generic"` and
          is not exposed in the accessibility tree, so an `aria-describedby` here describes nothing.
          That is how the pre-E2 markup had it, and it is why a box could announce itself "invalid"
          with no way to hear why. */}
      <div className={styles.group}>
        {ALL_ORDER_TYPES.map((orderType) => (
          <CheckboxField
            key={orderType}
            label={orderTypeLabel(orderType, t)}
            checked={selected.includes(orderType)}
            disabled={disabled}
            // `invalid`, not `error`: the failure is "none selected", a property of the SET, so
            // every box reports itself invalid while the message is rendered once, below.
            invalid={Boolean(error)}
            describedBy={error && errorId ? errorId : undefined}
            onChange={() => onToggle(orderType)}
            styles={checkboxStyles}
            data-testid={`channel-${orderType}`}
          />
        ))}
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
