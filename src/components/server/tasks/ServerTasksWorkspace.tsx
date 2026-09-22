'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import OperationResultNotice, {
  type OperationResultNoticeProps,
} from '@/components/design-system/OperationResultNotice';
import StatusBadge from '@/components/design-system/StatusBadge';
import { ApiError } from '@/utils/apiClient';
import { useServerTasks, type ServerTasksState } from '@/hooks/serverWorkspace/useServerTasks';
import type { ServerTaskBucket } from '@/types/serverTasks';
import ServerTaskCard from './ServerTaskCard';
import styles from './ServerTasksWorkspace.module.css';

const BUCKETS: readonly ServerTaskBucket[] = ['ready', 'overdue', 'exception'];
const BUCKET_COPY: Readonly<Record<ServerTaskBucket, readonly [string, string]>> = {
  ready: ['server.tasks.bucket_ready', 'Ready'],
  overdue: ['server.tasks.bucket_overdue', 'Overdue'],
  exception: ['server.tasks.bucket_exception', 'Exception'],
};

function bucketTone(bucket: ServerTaskBucket): 'success' | 'warning' | 'danger' {
  if (bucket === 'ready') return 'success';
  if (bucket === 'exception') return 'danger';
  return 'warning';
}

function connectionState(states: readonly ServerTasksState[]) {
  if (states.some((state) => state.error && !state.loaded)) return 'offline' as const;
  if (states.some((state) => state.isStale)) return 'stale' as const;
  if (states.some((state) => state.isLoading)) return 'reconnecting' as const;
  return 'connected' as const;
}

function latestServerTime(states: readonly ServerTasksState[]): string | null {
  return (
    states
      .map((state) => state.serverTime)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => left.localeCompare(right))
      .at(-1) ?? null
  );
}

function actionError(reason: unknown, t: TFunction): string {
  if (reason instanceof ApiError) {
    switch (reason.errorCode) {
      case 'OrderVersionConflict':
        return t('server.tasks.version_conflict', 'This order changed. The task list was refreshed.');
      case 'RequiredRoutingUnresolved':
        return t('server.tasks.reason_required_routing', 'Resolve required routing before delivery.');
      default:
        break;
    }
  }
  return t('server.tasks.delivery_failed', 'The task could not be updated. Try again.');
}

function bucketTitle(bucket: ServerTaskBucket, t: TFunction): string {
  return t(...BUCKET_COPY[bucket]);
}

interface BucketPanelProps {
  readonly bucket: ServerTaskBucket;
  readonly state: ServerTasksState;
  readonly busyOrderId: string | null;
  readonly onDeliver: (orderId: string) => void;
}

function BucketPanel({ bucket, state, busyOrderId, onDeliver }: BucketPanelProps) {
  const { t } = useTranslation();
  let content;
  if (state.error && !state.loaded) {
    content = (
      <div className={styles.statePanel} role="alert">
        <p>{t(state.error, state.error)}</p>
        <button type="button" className={styles.retry} onClick={() => void state.refresh()}>
          {t('retry', 'Retry')}
        </button>
      </div>
    );
  } else if (state.items.length === 0 && state.isLoading) {
    content = (
      <div className={styles.statePanel} aria-live="polite">
        {t('server.tasks.loading', 'Loading tasks…')}
      </div>
    );
  } else if (state.items.length === 0) {
    content = <p className={styles.empty}>{t('server.tasks.empty', 'No tasks in this bucket.')}</p>;
  } else {
    content = (
      <div className={styles.taskList}>
        {state.items.map((task) => (
          <ServerTaskCard key={task.orderId} task={task} isBusy={busyOrderId === task.orderId} onDeliver={onDeliver} />
        ))}
      </div>
    );
  }
  return (
    <section className={styles.bucketPanel} aria-labelledby={`server-task-bucket-${bucket}`}>
      <header className={styles.bucketHeader}>
        <h2 id={`server-task-bucket-${bucket}`}>{bucketTitle(bucket, t)}</h2>
        <StatusBadge tone={bucketTone(bucket)}>{state.totalCount}</StatusBadge>
      </header>
      {content}
      {state.hasMore && (
        <button
          type="button"
          className={styles.loadMore}
          onClick={() => void state.loadMore()}
          disabled={state.isLoading}
        >
          {t('server.tasks.load_more', 'Load more')}
        </button>
      )}
    </section>
  );
}

export default function ServerTasksWorkspace() {
  const { t } = useTranslation();
  const ready = useServerTasks('ready');
  const overdue = useServerTasks('overdue');
  const exception = useServerTasks('exception');
  const states = useMemo(() => [ready, overdue, exception], [exception, overdue, ready]);
  const [selectedBucket, setSelectedBucket] = useState<ServerTaskBucket>('ready');
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Pick<OperationResultNoticeProps, 'state' | 'message'> | null>(null);
  const stateByBucket: Record<ServerTaskBucket, ServerTasksState> = { ready, overdue, exception };
  const active = stateByBucket[selectedBucket];
  const total = states.reduce((sum, state) => sum + state.totalCount, 0);

  const handleDeliver = async (orderId: string) => {
    setBusyOrderId(orderId);
    setNotice(null);
    try {
      await active.deliver(orderId);
      setNotice({ state: 'committed', message: t('server.tasks.delivery_saved', 'Task updated.') });
    } catch (reason: unknown) {
      setNotice({ state: 'failed', message: actionError(reason, t) });
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        {
          href: '/server/tasks',
          label: t('server.tasks.title', 'Tasks'),
          active: true,
          badge: (
            <StatusBadge
              size="sm"
              tone={total > 0 ? 'warning' : 'neutral'}
              ariaLabel={t('server.tasks.badge', '{{count}} open tasks', { count: total })}
            >
              {total}
            </StatusBadge>
          ),
        },
        { href: '/server/takeaway', label: t('server.takeaway.link') },
      ]}
      connectionState={connectionState(states)}
      lastConfirmed={latestServerTime(states)}
      onRetryConnection={() => void Promise.all(states.map((state) => state.refresh()))}
      className={styles.shell}
    >
      <div className={styles.workspace} data-testid="server-tasks-workspace">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{t('staff.workspace', 'Staff workspace')}</p>
            <h1>{t('server.tasks.title', 'Service tasks')}</h1>
            <p>{t('server.tasks.description', 'Orders needing a server decision, ordered by server time.')}</p>
          </div>
          <output className={styles.total} aria-live="polite">
            {t('server.tasks.total_count', '{{count}} open tasks', { count: total })}
          </output>
        </header>

        {notice && <OperationResultNotice state={notice.state} message={notice.message} />}

        <div className={styles.bucketTabs} role="tablist" aria-label={t('server.tasks.buckets', 'Task buckets')}>
          {BUCKETS.map((bucket) => {
            const state = stateByBucket[bucket];
            return (
              <button
                type="button"
                role="tab"
                aria-selected={selectedBucket === bucket}
                aria-controls={`server-task-panel-${bucket}`}
                className={styles.bucketTab}
                data-active={selectedBucket === bucket}
                key={bucket}
                onClick={() => setSelectedBucket(bucket)}
              >
                <span>{bucketTitle(bucket, t)}</span>
                <StatusBadge tone={bucketTone(bucket)} size="sm">
                  {state.totalCount}
                </StatusBadge>
              </button>
            );
          })}
        </div>

        <div id={`server-task-panel-${selectedBucket}`} role="tabpanel" className={styles.panel}>
          <BucketPanel bucket={selectedBucket} state={active} busyOrderId={busyOrderId} onDeliver={handleDeliver} />
        </div>
      </div>
    </StaffWorkspaceShell>
  );
}
