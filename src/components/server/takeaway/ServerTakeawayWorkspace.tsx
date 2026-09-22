'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import ProductCustomization from '@/components/catalog/ProductCustomization';
import DraftRecoveryBanner from '@/components/design-system/DraftRecoveryBanner';
import OperationResultNotice from '@/components/design-system/OperationResultNotice';
import OperationalSplitView from '@/components/design-system/OperationalSplitView';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import StatusBadge from '@/components/design-system/StatusBadge';
import { useAuth } from '@/components/AuthContext';
import { useServerTaskSummary } from '@/contexts/ServerTaskContext';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import { OrderType } from '@/types/order';
import { useServerTakeaway } from '@/hooks/serverTakeaway/useServerTakeaway';
import ServerTakeawayCatalog from './ServerTakeawayCatalog';
import ServerTakeawayTicket from './ServerTakeawayTicket';
import styles from './ServerTakeawayWorkspace.module.css';
import ServerTasksBadge from '@/components/server/tasks/ServerTasksBadge';

function messageFor(error: string | null, translate: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('server.takeaway.') ? translate(error) : error;
}

export default function ServerTakeawayWorkspace() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { serverWorkspaceV2 } = useTenantFeatures();
  const taskSummary = useServerTaskSummary();
  const takeaway = useServerTakeaway();
  const [detailOpen, setDetailOpen] = useState(false);
  const reviewing = takeaway.phase !== 'idle';
  const canCollectPayment = user?.role?.toLowerCase() === 'admin';

  useEffect(() => {
    if (takeaway.items.length > 0) setDetailOpen(true);
  }, [takeaway.items.length]);

  const navItems = serverWorkspaceV2
    ? [
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks'), badge: <ServerTasksBadge /> },
        { href: '/server/takeaway', label: t('server.takeaway.title'), active: true },
      ]
    : [
        { href: '/server', label: t('server.takeaway.server_tasks') },
        { href: '/server/takeaway', label: t('server.takeaway.title'), active: true },
      ];

  return (
    <StaffWorkspaceShell
      navItems={navItems}
      connectionState={serverWorkspaceV2 ? taskSummary.connectionState : undefined}
      lastConfirmed={serverWorkspaceV2 ? taskSummary.lastConfirmed : undefined}
      onRetryConnection={serverWorkspaceV2 ? () => void taskSummary.refresh() : undefined}
      className={styles.shell}
    >
      <div className={styles.workspace}>
        <header className={styles.heading}>
          <div>
            <h1>{t('server.takeaway.title')}</h1>
            <p>{t('server.takeaway.description')}</p>
          </div>
          <Link className={styles.returnLink} href="/server">
            {t('server.takeaway.return_to_server')}
          </Link>
        </header>

        {takeaway.draftRecovered && (
          <DraftRecoveryBanner
            scopeLabel={t('server.takeaway.draft_scope')}
            onResume={takeaway.resumeDraft}
            onDiscard={takeaway.discardDraft}
            isBusy={reviewing}
          />
        )}

        {takeaway.operationState === 'failed' && (
          <OperationResultNotice
            state="failed"
            operationId={takeaway.lastOperationId}
            message={messageFor(takeaway.error, t) ?? t('server.takeaway.error_retry')}
            onRetry={() => void takeaway.review()}
          />
        )}

        {takeaway.operationState === 'committed' && takeaway.createdOrder && (
          <section className={styles.success} aria-live="polite">
            <StatusBadge tone="success">{t('staff.operation_committed')}</StatusBadge>
            <p>
              {t('server.takeaway.sent_message', {
                orderNumber: takeaway.createdOrder.orderNumber ?? takeaway.createdOrder.id,
              })}
            </p>
            <p>
              <strong>{t('server.takeaway.order_number')}:</strong>{' '}
              <span dir="auto">{takeaway.createdOrder.orderNumber ?? takeaway.createdOrder.id}</span>
            </p>
            <div className={styles.successActions}>
              {canCollectPayment && (
                <Link
                  className={styles.returnLink}
                  href={`/cashier/collection?order=${encodeURIComponent(takeaway.createdOrder.id)}`}
                >
                  {t('server.takeaway.collect_payment')}
                </Link>
              )}
              <Link className={styles.returnLink} href="/server">
                {t('server.takeaway.return_to_server')}
              </Link>
              <button type="button" className={styles.newOrder} onClick={takeaway.discardDraft}>
                {t('server.takeaway.new_order')}
              </button>
            </div>
          </section>
        )}

        <OperationalSplitView
          detailOpen={detailOpen}
          onBack={() => setDetailOpen(false)}
          backLabel={t('server.takeaway.back_to_catalog')}
          master={
            <ServerTakeawayCatalog
              categories={takeaway.categories}
              products={takeaway.products}
              isLoading={takeaway.isLoading}
              error={takeaway.catalogError}
              selectedCategoryId={takeaway.selectedCategoryId}
              onSelectCategory={takeaway.setSelectedCategoryId}
              searchQuery={takeaway.searchQuery}
              onSearchChange={takeaway.setSearchQuery}
              onRetry={takeaway.retry}
              tapPendingId={takeaway.tapPendingId}
              onTapProduct={(product) => void takeaway.tapProduct(product)}
            />
          }
          detail={
            <ServerTakeawayTicket
              items={takeaway.items}
              ticketTotal={takeaway.ticketTotal}
              quote={takeaway.quote}
              phase={takeaway.phase}
              notes={takeaway.notes}
              onNotesChange={takeaway.setNotes}
              onSetQuantity={takeaway.setItemQuantity}
              onRemove={takeaway.removeItem}
              canUndo={takeaway.lastRemoved !== null}
              onUndo={takeaway.undoRemove}
              onReview={() => void takeaway.review()}
              disabled={reviewing}
            />
          }
        />
      </div>

      {takeaway.selectedProduct && (
        <ProductCustomization
          product={takeaway.selectedProduct}
          isOpen
          onClose={takeaway.closeCustomization}
          onConfirm={takeaway.confirmCustomization}
          requestedOrderType={OrderType.Takeaway}
        />
      )}
    </StaffWorkspaceShell>
  );
}
