'use client';

import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useServerTaskSummary } from '@/contexts/ServerTaskContext';

export default function ServerTasksBadge() {
  const { t } = useTranslation();
  const { count } = useServerTaskSummary();
  return (
    <StatusBadge
      size="sm"
      tone={count > 0 ? 'warning' : 'neutral'}
      ariaLabel={t('server.tasks.badge', '{{count}} open tasks', { count })}
    >
      {count}
    </StatusBadge>
  );
}
