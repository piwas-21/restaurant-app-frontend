'use client';

import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelException } from '@/types/deliveryChannelExceptions';
import type { DeliveryChannelOperationFeedback } from '@/hooks/admin/useDeliveryChannelOperations';
import { formatDeliveryChannelDate } from '@/lib/deliveryChannelFormat';
import styles from './DeliveryChannelExceptionInbox.module.css';

interface Props {
  readonly items: readonly DeliveryChannelException[];
  readonly checkedAt: string | null;
  readonly stale: boolean;
  readonly errorMessage?: string | null;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  readonly busy: string | null;
  readonly feedback: DeliveryChannelOperationFeedback | null;
  readonly locale: string;
  readonly onReconcile: (id: string) => Promise<void>;
  readonly onLoadMore: () => Promise<void>;
}

function stateTone(item: DeliveryChannelException): 'success' | 'warning' | 'danger' | 'neutral' {
  if (item.status === 'resolved') return 'success';
  if (item.severity === 'critical') return 'danger';
  return 'warning';
}

export default function DeliveryChannelExceptionInbox({
  items,
  checkedAt,
  stale,
  errorMessage,
  hasMore,
  loadingMore,
  busy,
  feedback,
  locale,
  onReconcile,
  onLoadMore,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const ordered = [...items].sort((a, b) => {
    const priority = (item: DeliveryChannelException) =>
      item.status === 'open' && item.severity === 'critical'
        ? 0
        : item.status === 'open'
          ? 1
          : item.status === 'reconciling'
            ? 2
            : 3;
    return priority(a) - priority(b);
  });

  return (
    <section className={styles.inbox} aria-labelledby="delivery-channel-exceptions-title">
      <div className={styles.heading}>
        <div>
          <h2 id="delivery-channel-exceptions-title" className={styles.title}>
            {t('deliveryChannels.exceptions.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.exceptions.description')}</p>
        </div>
        <p className={styles.checkedAt}>
          {t('deliveryChannels.lastChecked', {
            time: formatDeliveryChannelDate(checkedAt, locale, t('deliveryChannels.timeUnavailable')),
          })}
        </p>
      </div>

      {stale && (
        <p className={styles.warning} role="status">
          {errorMessage ?? t('deliveryChannels.exceptions.stale')}
        </p>
      )}
      {feedback?.kind === 'reconcile' && (
        <p className={feedback.outcome === 'confirmed' ? styles.success : styles.warning} role="status">
          {t(`deliveryChannels.exceptions.reconcile.${feedback.outcome}`)}
        </p>
      )}
      {items.length === 0 ? (
        <p className={styles.empty}>
          {t(stale ? 'deliveryChannels.exceptions.emptyStale' : 'deliveryChannels.exceptions.empty')}
        </p>
      ) : (
        <ul className={styles.list}>
          {ordered.map((item) => (
            <li
              key={item.id}
              className={item.severity === 'critical' && item.status === 'open' ? styles.critical : styles.exception}
            >
              <div className={styles.itemHeading}>
                <div>
                  <h3>
                    {t(`deliveryChannels.codes.${item.code}`, { defaultValue: t('deliveryChannels.codes.generic') })}
                  </h3>
                  <p>
                    {t(`deliveryChannels.exceptions.kind.${item.kind}`, {
                      defaultValue: t('deliveryChannels.exceptions.kind.unknown'),
                    })}
                  </p>
                </div>
                <StatusBadge tone={stateTone(item)}>
                  {t(`deliveryChannels.exceptions.status.${item.status}`, {
                    defaultValue: t('deliveryChannels.exceptions.status.open'),
                  })}
                </StatusBadge>
              </div>
              <p className={styles.detail}>
                {t(`deliveryChannels.exceptions.recovery.${item.kind}`, {
                  defaultValue: t('deliveryChannels.exceptions.recovery.unknown'),
                })}
              </p>
              {(item.providerOrderId || item.localOrderId) && (
                <dl className={styles.ids}>
                  {item.providerOrderId && (
                    <div>
                      <dt>{t('deliveryChannels.exceptions.providerOrder')}</dt>
                      <dd>
                        <code dir="ltr">{item.providerOrderId}</code>
                      </dd>
                    </div>
                  )}
                  {item.localOrderId && (
                    <div>
                      <dt>{t('deliveryChannels.exceptions.localOrder')}</dt>
                      <dd>
                        <code dir="ltr">{item.localOrderId}</code>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              {item.localOrderId && (
                <Link className={styles.action} href={`/${locale}/admin/orders-management`}>
                  {t('deliveryChannels.exceptions.openOrderQueue')}
                </Link>
              )}
              <p className={styles.updated}>
                {t('deliveryChannels.exceptions.updated', {
                  time: formatDeliveryChannelDate(item.updatedAt, locale, t('deliveryChannels.timeUnavailable')),
                })}
              </p>
              {item.automaticRetryBlocked && (
                <p className={styles.warning}>{t('deliveryChannels.exceptions.noAutomaticRetry')}</p>
              )}
              {item.canReconcile && item.status !== 'resolved' && (
                <button
                  className={styles.action}
                  type="button"
                  onClick={() => void onReconcile(item.id)}
                  disabled={busy !== null || stale}
                >
                  {busy === 'reconcile'
                    ? t('deliveryChannels.loading')
                    : t('deliveryChannels.exceptions.checkProviderState')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.disclaimer}>{t('deliveryChannels.exceptions.readbackOnly')}</p>
      {hasMore && (
        <button
          className={styles.secondaryAction}
          type="button"
          onClick={() => void onLoadMore()}
          disabled={loadingMore || stale}
        >
          {loadingMore ? t('deliveryChannels.loading') : t('deliveryChannels.exceptions.loadMore')}
        </button>
      )}
    </section>
  );
}
