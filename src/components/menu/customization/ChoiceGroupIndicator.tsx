'use client';

import { Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './ChoiceGroupIndicator.module.css';

interface ChoiceGroupIndicatorProps {
  kind: 'note' | 'badge';
}

/** Explains and marks optional ingredients that replace another option in the same choice group. */
export default function ChoiceGroupIndicator({ kind }: Readonly<ChoiceGroupIndicatorProps>) {
  const { t } = useTranslation();

  if (kind === 'badge') {
    return <span className={styles.badge}>{t('ingredient_choice_badge')}</span>;
  }

  return (
    <div className={styles.note} role="note">
      <Repeat2 size={18} aria-hidden="true" />
      <span>{t('ingredient_choice_guest_explanation')}</span>
    </div>
  );
}
