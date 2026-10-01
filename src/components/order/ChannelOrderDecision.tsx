'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { getErrorMessage } from '@/utils/apiClient';
import type { OrderDto } from '@/types/order';
import type { ChannelDecisionAction } from '@/types/order/channelDecision';
import { useChannelDecision } from '@/hooks/useChannelDecision';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import styles from './ChannelOrderDecision.module.css';

const reasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(250)
  .regex(/^[^\u0000-\u001f\u007f-\u009f]+$/);
interface Props {
  readonly order: OrderDto;
  readonly onOrderChanged?: () => void;
}

export default function ChannelOrderDecision({ order, onOrderChanged }: Props) {
  const { t } = useTranslation();
  const decision = useChannelDecision(order.id, Boolean(order.externalOrder), onOrderChanged);
  const [draft, setDraft] = useState<{ orderId: string; action: ChannelDecisionAction; reason: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  if (!order.externalOrder) return null;

  const currentDraft = draft?.orderId === order.id ? draft : null;
  const canDecide =
    order.externalOrder.externalState === 'CREATED' &&
    order.status === 'PendingApproval' &&
    !order.isKitchenReleased &&
    !decision.decision &&
    decision.rejectedVersion !== order.version;
  const choose = (action: ChannelDecisionAction) => {
    setInvalid(false);
    setDraft({ orderId: order.id, action, reason: '' });
  };
  const confirm = () => {
    if (!currentDraft) return;
    const reason = reasonSchema.safeParse(currentDraft.reason);
    if (!reason.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    void decision.submit({ action: currentDraft.action, reason: reason.data, expectedVersion: order.version });
  };
  const state = decision.decision?.state;
  const confirmed = state === 'Succeeded';

  return (
    <section className={styles.panel} aria-label={t('delivery_channels.decision_title')}>
      <h3>{t('delivery_channels.decision_title')}</h3>
      <p>{t('delivery_channels.decision_help')}</p>
      <div aria-live="polite" className={styles.status}>
        {decision.loading && <StatusBadge>{t('delivery_channels.decision_loading')}</StatusBadge>}
        {state && (
          <StatusBadge tone={confirmed ? 'success' : state === 'Failed' ? 'danger' : 'warning'}>
            {t(`delivery_channels.decision_${state.toLowerCase()}`)}
          </StatusBadge>
        )}
        {decision.decision && <p>{t(`delivery_channels.decision_action_${decision.decision.action}`)}</p>}
      </div>
      {(Boolean(decision.error) || decision.rejectedVersion === order.version) && (
        <p role="alert">{getErrorMessage(decision.error) ?? t('delivery_channels.decision_error')}</p>
      )}
      {canDecide && !decision.loading && !decision.uncertain && !decision.error && (
        <>
          {!currentDraft ? (
            <div className={styles.buttons}>
              <button type="button" onClick={() => choose('accept')}>
                {t('delivery_channels.decision_accept')}
              </button>
              <button type="button" onClick={() => choose('deny')}>
                {t('delivery_channels.decision_deny')}
              </button>
            </div>
          ) : (
            <>
              <p>{t(`delivery_channels.decision_confirm_${currentDraft.action}`)}</p>
              <FormField
                label={t('delivery_channels.decision_reason')}
                error={invalid ? t('delivery_channels.decision_reason_invalid') : undefined}
              >
                <input
                  type="text"
                  maxLength={250}
                  value={currentDraft.reason}
                  dir="auto"
                  onChange={(event) => setDraft({ ...currentDraft, reason: event.target.value })}
                />
              </FormField>
              <div className={styles.buttons}>
                <button type="button" onClick={confirm}>
                  {t('delivery_channels.decision_submit')}
                </button>
                <button type="button" onClick={() => setDraft(null)}>
                  {t('delivery_channels.decision_back')}
                </button>
              </div>
            </>
          )}
        </>
      )}
      {decision.uncertain && !decision.decision && <p>{t('delivery_channels.decision_uncertain')}</p>}
      <div className={styles.buttons}>
        {decision.uncertain && !decision.decision && (
          <button type="button" disabled={decision.saving || decision.loading} onClick={decision.retry}>
            {t('delivery_channels.decision_retry')}
          </button>
        )}
        <button type="button" disabled={decision.saving || decision.loading} onClick={decision.reload}>
          {t('delivery_channels.decision_refresh')}
        </button>
      </div>
    </section>
  );
}
