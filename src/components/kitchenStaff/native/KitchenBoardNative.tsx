'use client';

import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import { useKitchenBoardWork } from '@/hooks/kitchenBoard/useKitchenBoardWork';
import KitchenBoardCorrectionCard from './KitchenBoardCorrectionCard';
import KitchenBoardOrderCard from './KitchenBoardOrderCard';
import styles from './KitchenBoardNative.module.css';

export default function KitchenBoardNative() {
  const { t } = useTranslation();
  const { state, refresh, setOrderStatus, completeInitialOrder, completeCorrection } = useKitchenBoardWork(true);
  const actionsDisabled = state.isLoading || state.loadFailed || state.isStale || state.busyActionKey !== null;

  return (
    <section className={styles.board} aria-labelledby="native-kitchen-title" aria-busy={state.isLoading}>
      <header className={styles.header}>
        <div>
          <h1 id="native-kitchen-title" className={styles.title}>
            {t('nativeKitchenBoard.title')}
          </h1>
          <p className={styles.description}>{t('nativeKitchenBoard.description')}</p>
        </div>
        <StaffButton disabled={state.isLoading} onClick={() => void refresh()}>
          {t('nativeKitchenBoard.refresh')}
        </StaffButton>
      </header>

      {state.isStale && (
        <div className={styles.notice} role="alert">
          <span>{t('nativeKitchenBoard.stale')}</span>
          <StaffButton disabled={state.isLoading} onClick={() => void refresh()}>
            {t('nativeKitchenBoard.retry')}
          </StaffButton>
        </div>
      )}
      {state.loadFailed && !state.loaded && (
        <div className={styles.notice} role="alert">
          <span>{t('nativeKitchenBoard.loadFailed')}</span>
          <StaffButton disabled={state.isLoading} onClick={() => void refresh()}>
            {t('nativeKitchenBoard.retry')}
          </StaffButton>
        </div>
      )}
      {state.actionFailed && (
        <p className={styles.notice} role="alert">
          {t('nativeKitchenBoard.actionFailed')}
        </p>
      )}
      {state.isLoading && !state.loaded && <output className={styles.empty}>{t('loading')}</output>}

      {state.loaded && (
        <>
          {state.orders.length === 0 && state.corrections.length === 0 ? (
            <p className={styles.empty}>{t('nativeKitchenBoard.empty')}</p>
          ) : (
            <div className={styles.lists}>
              {state.orders.length > 0 && (
                <section className={styles.group} aria-labelledby="native-kitchen-orders">
                  <h2 id="native-kitchen-orders" className={styles.groupTitle}>
                    {t('nativeKitchenBoard.orders')}
                  </h2>
                  <div className={styles.cards}>
                    {state.orders.map((order) => (
                      <KitchenBoardOrderCard
                        key={order.orderId}
                        order={order}
                        disabled={actionsDisabled}
                        onPreparing={() => void setOrderStatus(order.orderId, 'Preparing')}
                        onReady={() => void setOrderStatus(order.orderId, 'Ready')}
                        onComplete={() => void completeInitialOrder(order.orderId)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {state.corrections.length > 0 && (
                <section className={styles.group} aria-labelledby="native-kitchen-corrections">
                  <h2 id="native-kitchen-corrections" className={styles.groupTitle}>
                    {t('nativeKitchenBoard.corrections')}
                  </h2>
                  <div className={styles.cards}>
                    {state.corrections.map((correction) => (
                      <KitchenBoardCorrectionCard
                        key={correction.workItemId}
                        correction={correction}
                        disabled={actionsDisabled}
                        onComplete={() => void completeCorrection(correction.workItemId)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
