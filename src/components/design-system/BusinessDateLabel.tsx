'use client';

import { useTranslation } from 'react-i18next';
import { formatBusinessDate } from '@/lib/formatBusinessDate';
import styles from './BusinessDateLabel.module.css';

export default function BusinessDateLabel({ businessDate }: Readonly<{ businessDate: string | null | undefined }>) {
  const { i18n } = useTranslation();
  const formatted = formatBusinessDate(businessDate, i18n?.language ?? 'en');
  if (!formatted || !businessDate) return null;

  return (
    <time className={styles.date} dateTime={businessDate}>
      {formatted}
    </time>
  );
}
