'use client';

import { useTranslation } from 'react-i18next';

export interface BasketChannelRecoveryAlertProps {
  visible: boolean;
  message: string | null;
  isRetrying: boolean;
  onRetry: () => void | Promise<void>;
  alertClassName: string;
  retryButtonClassName: string;
}

/** Shared recovery copy and retry control; callers keep their own template styling. */
export default function BasketChannelRecoveryAlert({
  visible,
  message,
  isRetrying,
  onRetry,
  alertClassName,
  retryButtonClassName,
}: Readonly<BasketChannelRecoveryAlertProps>) {
  const { t } = useTranslation();
  if (!visible) return null;

  return (
    <div className={alertClassName} role="alert">
      <p>{message ?? t('basket_channel_recovery_message')}</p>
      <button type="button" className={retryButtonClassName} disabled={isRetrying} onClick={() => void onRetry()}>
        {t('retry', 'Retry')}
      </button>
    </div>
  );
}
