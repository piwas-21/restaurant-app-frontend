import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import type { OrderItemDto } from '@/types/order';
import type { OrderAmendmentChangeKind } from '@/types/orderAmendment';
import type { UnitRange } from './orderAmendmentViewTypes';
import { orderItemTitle } from './orderAmendmentPresentation';
import styles from './OrderAmendmentEditStage.module.css';

const MAX_PREPARATION_INSTRUCTION_LENGTH = 500;

export type SourceLineAction = OrderAmendmentChangeKind | 'None';

interface OrderAmendmentSourceLineProps {
  readonly item: OrderItemDto;
  readonly action: SourceLineAction;
  readonly range: UnitRange;
  readonly instruction: string;
  readonly disabled: boolean;
  readonly onActionChange: (action: SourceLineAction) => void;
  readonly onRangeChange: (range: UnitRange) => void;
  readonly onInstructionChange: (value: string) => void;
}

export default function OrderAmendmentSourceLine({
  item,
  action,
  range,
  instruction,
  disabled,
  onActionChange,
  onRangeChange,
  onInstructionChange,
}: Readonly<OrderAmendmentSourceLineProps>) {
  const { t } = useTranslation();
  const lineId = `amendment-line-${item.id}`;
  return (
    <article className={styles.sourceLine}>
      <div className={styles.lineHeading}>
        <strong dir="auto">{orderItemTitle(item)}</strong>
        <span>{t('orderAmendments.line_quantity', 'Quantity: {{count}}', { count: item.quantity })}</span>
      </div>
      {item.variationName && <p className={styles.lineMeta}>{item.variationName}</p>}
      {item.specialInstructions && <p className={styles.lineMeta}>{item.specialInstructions}</p>}
      <FormField label={t('orderAmendments.change_action', 'Change this line')}>
        <select
          value={action}
          onChange={(event) => onActionChange(event.target.value as SourceLineAction)}
          disabled={disabled}
        >
          <option value="None">{t('orderAmendments.keep_line', 'Keep line')}</option>
          <option value="Void">{t('orderAmendments.void_units', 'Remove units')}</option>
          <option value="Replace">{t('orderAmendments.replace_units', 'Replace units')}</option>
          <option value="InstructionChange">{t('orderAmendments.change_instructions', 'Change instructions')}</option>
        </select>
      </FormField>
      {(action === 'Void' || action === 'Replace') && (
        <div className={styles.rangeFields}>
          <FormField label={t('orderAmendments.start_ordinal', 'First unit number')}>
            <input
              type="number"
              min={1}
              max={item.quantity}
              value={range.startOrdinal}
              onChange={(event) => onRangeChange({ ...range, startOrdinal: Number(event.target.value) || 1 })}
              disabled={disabled}
            />
          </FormField>
          <FormField label={t('orderAmendments.quantity', 'Units')}>
            <input
              type="number"
              min={1}
              max={Math.max(1, item.quantity - range.startOrdinal + 1)}
              value={range.quantity}
              onChange={(event) => onRangeChange({ ...range, quantity: Number(event.target.value) || 1 })}
              disabled={disabled}
            />
          </FormField>
        </div>
      )}
      {action === 'Replace' && (
        <p className={styles.inlineHint}>
          {t('orderAmendments.choose_replacement', 'Choose the replacement item from the catalogue below.')}
        </p>
      )}
      {action === 'InstructionChange' && (
        <FormField label={t('orderAmendments.instructions', 'Preparation instructions')}>
          <textarea
            id={`${lineId}-instructions`}
            value={instruction}
            onChange={(event) => onInstructionChange(event.target.value)}
            rows={2}
            maxLength={MAX_PREPARATION_INSTRUCTION_LENGTH}
            disabled={disabled}
          />
        </FormField>
      )}
    </article>
  );
}
