'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import OrderStatusBadge from '@/components/design-system/OrderStatusBadge';
import StatusBadge from '@/components/design-system/StatusBadge';
import { paymentStatusLabel } from '@/lib/paymentStatus';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import { orderNeedsPreparingOverride, toAmendmentItemSnapshot } from './orderAmendmentPresentation';
import { serverSourceChangesReadOnly, sourceLineRange, updateOrderAmendmentChange } from './orderAmendmentDraft';
import OrderAmendmentCatalogComposer from './OrderAmendmentCatalogComposer';
import OrderAmendmentSourceLine, { type SourceLineAction } from './OrderAmendmentSourceLine';
import type { UnitRange } from './orderAmendmentViewTypes';
import styles from './OrderAmendmentEditStage.module.css';

interface OrderAmendmentEditStageProps {
  readonly order: OrderDto;
  readonly draft: OrderAmendmentDraft;
  readonly onDraftChange: (draft: OrderAmendmentDraft) => void;
  readonly operatorRole: 'Server' | 'Cashier' | 'Admin';
}

export default function OrderAmendmentEditStage({
  order,
  draft,
  onDraftChange,
  operatorRole,
}: Readonly<OrderAmendmentEditStageProps>) {
  const { t } = useTranslation();
  const [ranges, setRanges] = useState<Record<string, UnitRange>>({});
  const [instructionDrafts, setInstructionDrafts] = useState<Record<string, string>>({});
  const pendingReplacement = draft.changes.find((change) => change.kind === 'Replace' && !change.current);
  const hasExistingChanges = draft.changes.length > 0;
  const replacementBlocked = Boolean(pendingReplacement);
  const preparingOverrideRequired = orderNeedsPreparingOverride(order, hasExistingChanges);
  const serverSourceReadOnly = operatorRole === 'Server' && serverSourceChangesReadOnly(order);

  const changeAction = (lineId: string): SourceLineAction => {
    const change = draft.changes.find((item) => item.orderItemId === lineId);
    if (change) return change.kind;
    if (Object.hasOwn(instructionDrafts, lineId)) return 'InstructionChange';
    return 'None';
  };

  const chooseAction = (line: OrderDto['items'][number], action: SourceLineAction) => {
    if (action === 'None') {
      onDraftChange(updateOrderAmendmentChange(draft, line.id, null));
      setInstructionDrafts((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
      return;
    }

    const range = sourceLineRange(line, ranges);
    if (action === 'Replace' || action === 'Void') {
      const change = {
        orderItemId: line.id,
        kind: action,
        startOrdinal: range.startOrdinal,
        quantity: range.quantity,
        ...(action === 'Replace' ? { current: null } : {}),
      } as OrderAmendmentDraft['changes'][number];
      onDraftChange(updateOrderAmendmentChange(draft, line.id, change));
      return;
    }

    setInstructionDrafts((current) => ({ ...current, [line.id]: line.specialInstructions ?? '' }));
    onDraftChange(updateOrderAmendmentChange(draft, line.id, null));
  };

  const updateRange = (line: OrderDto['items'][number], nextRange: UnitRange) => {
    const startOrdinal = Math.max(1, Math.min(line.quantity, nextRange.startOrdinal));
    const quantity = Math.max(1, Math.min(line.quantity - startOrdinal + 1, nextRange.quantity));
    const range = { startOrdinal, quantity };
    setRanges((current) => ({ ...current, [line.id]: range }));
    const change = draft.changes.find((item) => item.orderItemId === line.id);
    if (change && (change.kind === 'Void' || change.kind === 'Replace')) {
      onDraftChange(updateOrderAmendmentChange(draft, line.id, { ...change, ...range }));
    }
  };

  const updateInstructions = (line: OrderDto['items'][number], instructions: string) => {
    setInstructionDrafts((current) => ({ ...current, [line.id]: instructions }));
    if (instructions === (line.specialInstructions ?? '')) {
      onDraftChange(updateOrderAmendmentChange(draft, line.id, null));
      return;
    }
    const current = toAmendmentItemSnapshot(line);
    onDraftChange(
      updateOrderAmendmentChange(draft, line.id, {
        orderItemId: line.id,
        kind: 'InstructionChange',
        startOrdinal: 0,
        quantity: 0,
        current: { ...current, specialInstructions: instructions || undefined },
      }),
    );
  };

  const lineActionsDisabled = (lineId: string) =>
    Boolean(order.externalOrder) ||
    serverSourceReadOnly ||
    (replacementBlocked && pendingReplacement?.orderItemId !== lineId);

  return (
    <div className={styles.editStage}>
      <section className={styles.stageSection} aria-labelledby="amendment-source-title">
        <div className={styles.sectionHeader}>
          <h3 id="amendment-source-title">{t('orderAmendments.original_order', 'Original order')}</h3>
          <span>{order.orderNumber}</span>
        </div>
        <div className={styles.orderState}>
          <span>{t('orderAmendments.service_state', 'Service')}</span>
          <OrderStatusBadge status={order.status} />
          <span>{t('orderAmendments.payment_state', 'Payment')}</span>
          <StatusBadge tone="neutral">{paymentStatusLabel(order.paymentStatus, t)}</StatusBadge>
        </div>
        {order.externalOrder && (
          <p className={styles.providerNotice} role="note">
            {t(
              'orderAmendments.provider_original_unchanged',
              'This provider order will stay unchanged. Only a separately disclosed local supplement can be quoted here.',
            )}
          </p>
        )}
        {serverSourceReadOnly && (
          <p className={styles.providerNotice} role="note">
            {t(
              'orderAmendments.served_server_source_read_only',
              'Servers can add a separately quoted supplement, but source-line corrections after dispatch or service require a Cashier or Admin.',
            )}
          </p>
        )}
        {order.items.map((line) => (
          <OrderAmendmentSourceLine
            key={line.id}
            item={line}
            action={changeAction(line.id)}
            range={sourceLineRange(line, ranges)}
            instruction={instructionDrafts[line.id] ?? line.specialInstructions ?? ''}
            disabled={lineActionsDisabled(line.id)}
            onActionChange={(action) => chooseAction(line, action)}
            onRangeChange={(range) => updateRange(line, range)}
            onInstructionChange={(value) => updateInstructions(line, value)}
          />
        ))}
      </section>

      <OrderAmendmentCatalogComposer order={order} draft={draft} onDraftChange={onDraftChange} />

      <section className={styles.formSection}>
        {hasExistingChanges && (
          <FormField label={t('orderAmendments.reason', 'Reason for this change')}>
            <textarea
              value={draft.reason}
              onChange={(event) => onDraftChange({ ...draft, reason: event.target.value })}
              maxLength={500}
              rows={2}
            />
          </FormField>
        )}
        {preparingOverrideRequired && (
          <CheckboxField
            label={t(
              'orderAmendments.preparing_override',
              'I acknowledge this order has entered preparation and needs a kitchen correction.',
            )}
            checked={draft.preparingOverrideAcknowledged}
            onChange={(preparingOverrideAcknowledged) => onDraftChange({ ...draft, preparingOverrideAcknowledged })}
          />
        )}
        {draft.additions.length > 0 && (
          <CheckboxField
            label={t('orderAmendments.release_to_kitchen', 'Release quoted additions to the kitchen after review.')}
            checked={draft.releaseAdditionsToKitchen}
            onChange={(releaseAdditionsToKitchen) => onDraftChange({ ...draft, releaseAdditionsToKitchen })}
          />
        )}
        {order.externalOrder && draft.additions.length > 0 && (
          <div className={styles.providerConsent}>
            <CheckboxField
              label={t(
                'orderAmendments.provider_consent',
                'I consent to a local supplement; the marketplace order will not be edited here.',
              )}
              checked={draft.localProviderSupplementConsent}
              onChange={(localProviderSupplementConsent) => onDraftChange({ ...draft, localProviderSupplementConsent })}
            />
            <FormField label={t('orderAmendments.provider_note', 'Provider follow-up note')}>
              <textarea
                value={draft.providerConsentNote}
                onChange={(event) => onDraftChange({ ...draft, providerConsentNote: event.target.value })}
                maxLength={500}
                rows={2}
              />
            </FormField>
          </div>
        )}
      </section>
    </div>
  );
}
