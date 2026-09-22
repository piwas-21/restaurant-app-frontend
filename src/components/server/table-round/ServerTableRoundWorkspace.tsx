'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ProductCustomization from '@/components/catalog/ProductCustomization';
import DraftRecoveryBanner from '@/components/design-system/DraftRecoveryBanner';
import OperationResultNotice from '@/components/design-system/OperationResultNotice';
import OperationalSplitView from '@/components/design-system/OperationalSplitView';
import StaffWorkspaceShell from '@/components/design-system/StaffWorkspaceShell';
import TableServiceSessionBill from '@/components/table-service/TableServiceSessionBill';
import WaiterBundleCustomization from '@/components/server/WaiterBundleCustomization';
import { OrderType } from '@/types/order';
import { formatTableMoney } from '@/lib/cashierTableSession';
import type { ServerTableSessionState } from '@/hooks/serverWorkspace/useServerTableSession';
import { useServerTableRound } from '@/hooks/serverTableRound/useServerTableRound';
import ServerTableRoundCatalog from './ServerTableRoundCatalog';
import ServerTableRoundTicket from './ServerTableRoundTicket';
import { serverTableRoundBlocker, serverTableRoundMessage } from './serverTableRoundMessages';
import styles from './ServerTableRoundWorkspace.module.css';
import ServerTasksBadge from '@/components/server/tasks/ServerTasksBadge';

interface Props {
  readonly tableId: string;
  readonly requestedSessionId?: string;
  readonly state: ServerTableSessionState;
}

export default function ServerTableRoundWorkspace({ tableId, requestedSessionId, state }: Props) {
  const { t } = useTranslation();
  const round = useServerTableRound(tableId, state, requestedSessionId);
  const [showCatalogOnPhone, setShowCatalogOnPhone] = useState(false);
  const label = state.table?.tableLabel || t('cashier.tables.table_number', 'Table {{table}}', { table: tableId });
  const hasDetail = round.items.length > 0 || round.operationState !== 'idle' || Boolean(round.createdOrder);
  const detailOpen = hasDetail && !showCatalogOnPhone;
  const sessionMismatch = !requestedSessionId || requestedSessionId !== state.session?.serviceSessionId;
  return (
    <StaffWorkspaceShell
      navItems={[
        { href: '/server/floor', label: t('server.floor_plan', 'Floor') },
        { href: '/server/tasks', label: t('server.tasks.title', 'Tasks'), badge: <ServerTasksBadge /> },
        { href: `/server/tables/${encodeURIComponent(tableId)}`, label: label },
      ]}
      connectionState={state.floorConnectionState}
      lastConfirmed={state.floorLastConfirmed}
      onRetryConnection={() => void state.refresh()}
      className={styles.shell}
    >
      <div className={styles.workspace}>
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>{t('server.round.eyebrow')}</p>
            <h1 dir="auto">{label}</h1>
            {state.table?.zoneName && <p className={styles.context}>{state.table.zoneName}</p>}
          </div>
          <Link className={styles.back} href={`/server/tables/${encodeURIComponent(tableId)}`}>
            {t('cashier.tables.back')}
          </Link>
        </header>
        {state.isStale && <output className={styles.stale}>{t('server.round.stale')}</output>}
        {sessionMismatch && (
          <div className={styles.warning} role="alert">
            {t('server.round.session_mismatch')}
          </div>
        )}
        {!state.session && (
          <div className={styles.warning} role="alert">
            {serverTableRoundBlocker(state, t)}
          </div>
        )}
        {state.session && !sessionMismatch && !state.isStale && !state.canAddRound && (
          <div className={styles.warning} role="alert">
            {t('server.round.not_permitted')}
          </div>
        )}
        {state.session && (
          <section className={styles.identity} aria-label={t('server.round.session_identity')}>
            <div>
              <strong dir="auto">{label}</strong>
              <span>{t('server.round.session_id', { id: state.session.serviceSessionId })}</span>
            </div>
            <div>
              <span>{t('cashier.tables.rounds_other', '{{count}} rounds', { count: state.session.roundCount })}</span>
              <strong>
                {formatTableMoney(state.session.bill.remaining, state.session) ?? t('cashier.tables.currency_unknown')}
              </strong>
            </div>
          </section>
        )}
        {state.session && <TableServiceSessionBill session={state.session} />}
        {round.draftRecovered && (
          <DraftRecoveryBanner
            scopeLabel={t('server.round.draft_scope', { table: label })}
            onResume={round.resumeDraft}
            onDiscard={round.discardDraft}
            isBusy={round.phase !== 'idle'}
          />
        )}
        {round.error && round.operationState === 'failed' && (
          <OperationResultNotice
            state="failed"
            operationId={round.operationId}
            message={serverTableRoundMessage(round.error, t) ?? t('server.round.review_failed')}
            onRetry={() => void round.review()}
          />
        )}
        {round.error && round.operationState === 'idle' && (
          <div className={styles.warning} role="alert">
            {serverTableRoundMessage(round.error, t)}
          </div>
        )}
        {round.operationState === 'unknown' && (
          <OperationResultNotice
            state="unknown"
            operationId={round.operationId}
            message={t('server.round.operation_unknown')}
            onReconcile={() => void round.reconcile()}
          />
        )}
        <OperationalSplitView
          detailOpen={detailOpen}
          onBack={() => setShowCatalogOnPhone(true)}
          backLabel={t('server.round.back_to_catalog')}
          master={
            <ServerTableRoundCatalog
              categories={round.categories}
              products={round.products}
              isLoading={round.isLoading}
              error={round.catalogError}
              selectedCategoryId={round.selectedCategoryId}
              onSelectCategory={round.setSelectedCategoryId}
              searchQuery={round.searchQuery}
              onSearchChange={round.setSearchQuery}
              onRetry={round.retry}
              onTapProduct={(product) => {
                setShowCatalogOnPhone(false);
                void round.tapProduct(product);
              }}
              tapPendingId={round.tapPendingId}
              favoriteIds={round.favoriteIds}
              showFavorites={round.showFavorites}
              onShowFavorites={round.setShowFavorites}
              onToggleFavorite={round.toggleFavorite}
            />
          }
          detail={
            <ServerTableRoundTicket
              items={round.items}
              ticketTotal={round.ticketTotal}
              quote={round.quote}
              createdOrder={round.createdOrder}
              phase={round.phase}
              operationState={round.operationState}
              notes={round.notes}
              onNotesChange={round.setNotes}
              onSetQuantity={round.setItemQuantity}
              onRemove={round.removeItem}
              onReview={() => void round.review()}
              canCompose={round.canCompose}
            />
          }
        />
      </div>
      {round.selectedProduct && (
        <ProductCustomization
          product={round.selectedProduct}
          isOpen
          onClose={round.closeCustomization}
          onConfirm={round.confirmCustomization}
          requestedOrderType={OrderType.DineIn}
        />
      )}
      {round.selectedBundle && (
        <WaiterBundleCustomization
          bundle={round.selectedBundle}
          isOpen
          onClose={round.closeBundle}
          onConfirm={round.confirmBundle}
        />
      )}
    </StaffWorkspaceShell>
  );
}
