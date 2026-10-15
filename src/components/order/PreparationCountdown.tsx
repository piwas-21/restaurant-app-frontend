'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './PreparationCountdown.module.css';

interface PreparationCountdownProps {
  readonly status: string;
  readonly expectedReadyAt?: string | null;
  readonly effectivePreparationMinutes?: number | null;
  readonly timeZone?: string | null;
}

const acceptedStatuses = new Set(['Confirmed', 'Preparing']);
const terminalStatuses = new Set(['Ready', 'Completed', 'Cancelled', 'Refunded']);

function remainingMinutes(value: string): number | null {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 60_000));
}

function formatBusinessTime(value: string, locale: string, timeZone?: string | null): string | null {
  if (!timeZone) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch (error: unknown) {
    if (error instanceof RangeError) return null;
    throw error;
  }
}

/** Server-promised preparation ETA. It stays hidden until the restaurant accepts the order. */
export default function PreparationCountdown({
  status,
  expectedReadyAt,
  effectivePreparationMinutes,
  timeZone,
}: PreparationCountdownProps) {
  const { t, i18n } = useTranslation();
  const [minutes, setMinutes] = useState<number | null>(() =>
    expectedReadyAt ? remainingMinutes(expectedReadyAt) : null,
  );

  useEffect(() => {
    if (!expectedReadyAt) {
      setMinutes(null);
      return;
    }
    const update = () => setMinutes(remainingMinutes(expectedReadyAt));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [expectedReadyAt]);

  if (!acceptedStatuses.has(status) || terminalStatuses.has(status)) return null;

  const time = expectedReadyAt ? formatBusinessTime(expectedReadyAt, i18n.language, timeZone) : null;
  const hasDuration =
    typeof effectivePreparationMinutes === 'number' &&
    Number.isFinite(effectivePreparationMinutes) &&
    effectivePreparationMinutes >= 0;
  if (minutes === null && !hasDuration) return null;

  let copy: string;
  if (minutes === null) {
    copy = t('orders.preparation_estimate', 'Preparation estimate: {{minutes}} min', {
      minutes: effectivePreparationMinutes,
    });
  } else if (minutes === 0) {
    copy = t('orders.expected_ready_now', 'Estimated preparation time reached. Awaiting restaurant update.');
  } else {
    copy = t('orders.expected_ready_in', 'Expected ready in {{minutes}} min', { minutes });
  }

  return (
    <p className={styles.countdown} aria-live="off">
      <Clock3 size={17} aria-hidden="true" />
      <span>{copy}</span>
      {time && (
        <time dateTime={expectedReadyAt ?? undefined}>{t('orders.expected_ready_at', '({{time}})', { time })}</time>
      )}
    </p>
  );
}
