import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import StaffButton from '@/components/design-system/StaffButton';
import { orderStatusLabel } from '@/lib/orderStatus';
import type { KitchenBoardChange, KitchenBoardCorrection } from '@/types/kitchenBoard';
import KitchenBoardItemTree from './KitchenBoardItemTree';
import { kitchenBoardLabelKey } from './kitchenBoardLabelKeys';
import styles from './KitchenBoardWorkCard.module.css';

function ChangeCard({ change }: Readonly<{ change: KitchenBoardChange }>) {
  const { t } = useTranslation();
  return (
    <li className={styles.change}>
      <strong>{t(kitchenBoardLabelKey('change', change.kind) ?? change.kind, { defaultValue: change.kind })}</strong>
      {change.previous && (
        <div>
          <span className={styles.changeLabel}>{t('nativeKitchenBoard.previous')}</span>
          <KitchenBoardItemTree items={[change.previous]} />
        </div>
      )}
      {change.current && (
        <div>
          <span className={styles.changeLabel}>{t('nativeKitchenBoard.current')}</span>
          <KitchenBoardItemTree items={[change.current]} />
        </div>
      )}
      {change.replacementDispatchedOrderNumber && (
        <p className={styles.meta}>
          {t('nativeKitchenBoard.replacementOrder', { number: change.replacementDispatchedOrderNumber })}
        </p>
      )}
    </li>
  );
}

export default function KitchenBoardCorrectionCard({
  correction,
  disabled,
  onComplete,
}: Readonly<{
  correction: KitchenBoardCorrection;
  disabled: boolean;
  onComplete: () => void;
}>) {
  const { t } = useTranslation();
  const location =
    correction.tableLabel ??
    (correction.tableNumber === null ? null : t('nativeKitchenBoard.tableNumber', { number: correction.tableNumber }));
  const resolved = correction.withdrawn || correction.isCompleted;

  return (
    <article className={styles.card} aria-labelledby={`kitchen-correction-${correction.workItemId}`}>
      <header className={styles.header}>
        <div>
          <h3 id={`kitchen-correction-${correction.workItemId}`} className={styles.title}>
            {t('nativeKitchenBoard.correctionFor', { number: correction.orderNumber })}
          </h3>
          <p className={styles.meta}>
            {location && <span>{location}</span>}
            <span>{orderStatusLabel(correction.status, t)}</span>
          </p>
        </div>
        <StatusBadge tone={correction.withdrawn ? 'neutral' : resolved ? 'success' : 'warning'}>
          {correction.withdrawn
            ? t('nativeKitchenBoard.withdrawn')
            : resolved
              ? t('nativeKitchenBoard.workCompleted')
              : t('nativeKitchenBoard.correction')}
        </StatusBadge>
      </header>

      {correction.summary && (
        <p className={styles.summary} dir="auto">
          {correction.summary}
        </p>
      )}
      {correction.changes.length > 0 && (
        <ul className={styles.changes}>
          {correction.changes.map((change, index) => (
            <ChangeCard key={`${correction.workItemId}-${change.kind}-${index}`} change={change} />
          ))}
        </ul>
      )}
      {correction.withdrawn && <p className={styles.meta}>{t('nativeKitchenBoard.withdrawnNotice')}</p>}
      {correction.isCompleted && !correction.withdrawn && (
        <p className={styles.completed}>{t('nativeKitchenBoard.correctionAcknowledged')}</p>
      )}
      {correction.canComplete && !resolved && (
        <div className={styles.footer}>
          <StaffButton variant="primary" disabled={disabled} onClick={onComplete}>
            {t('nativeKitchenBoard.acknowledgeCorrection')}
          </StaffButton>
        </div>
      )}
    </article>
  );
}
