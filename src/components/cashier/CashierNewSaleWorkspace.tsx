'use client';

import { useTranslation } from 'react-i18next';
import ProductCustomization from '@/components/catalog/ProductCustomization';
import CashierWorkspaceShell from './CashierWorkspaceShell';
import CashierNewSaleChannelBar from './CashierNewSaleChannelBar';
import CashierNewSaleCatalog from './CashierNewSaleCatalog';
import CashierNewSaleTicket from './CashierNewSaleTicket';
import { useCashierCatalog } from '@/hooks/cashier/useCashierCatalog';
import { useCashierNewSale } from '@/hooks/cashier/useCashierNewSale';
import { useCashierOrderRoute } from '@/hooks/cashier/useCashierOrderRoute';
import styles from './CashierNewSaleWorkspace.module.css';

function messageFor(error: string | null, t: (key: string) => string): string | null {
  if (!error) return null;
  return error.startsWith('cashier.') ? t(error) : error;
}

/**
 * The New sale destination (cashier POS redesign plan §5.3): channel bar, catalog on the left,
 * the persistent ticket on the right. State lives in `useCashierNewSale` + `useCashierCatalog`;
 * this component only wires the pieces together. The customization sheet is the shared catalog
 * sheet — the same one the waiter uses, never a second modifier implementation.
 */
export default function CashierNewSaleWorkspace() {
  const { t } = useTranslation();
  const route = useCashierOrderRoute();
  const catalog = useCashierCatalog();
  const sale = useCashierNewSale({ onCreated: route.navigateToCollection });
  const reviewing = sale.phase !== 'idle';

  return (
    <CashierWorkspaceShell activeDestination="new" queueState="ready" navigationDisabled={reviewing}>
      <div className={styles.layout}>
        <header>
          <h1 id="cashier-new-sale-title" className={styles.destinationTitle}>
            {t('cashier.workspace.new_sale')}
          </h1>
          <p className={styles.destinationDescription}>{t('cashier.workspace.new_sale_description')}</p>
        </header>
        <CashierNewSaleChannelBar
          enabled={sale.channelsEnabled}
          loading={sale.channelsLoading}
          selected={sale.channel}
          onSelect={sale.setChannel}
          tableNumber={sale.tableNumber}
          onTableNumberChange={sale.setTableNumber}
          disabled={reviewing}
        />
        {sale.error && !sale.sheetProduct && (
          <p className={styles.error} role="alert">
            {messageFor(sale.error, t)}
          </p>
        )}
        <div className={styles.panels}>
          <CashierNewSaleCatalog
            categories={catalog.categories}
            products={catalog.products}
            isLoading={catalog.isLoading}
            error={catalog.error}
            selectedCategoryId={catalog.selectedCategoryId}
            onSelectCategory={catalog.setSelectedCategoryId}
            searchQuery={catalog.searchQuery}
            onSearchChange={catalog.setSearchQuery}
            onRetry={catalog.retry}
            tapPendingId={sale.tapPendingId}
            onTapProduct={(product) => void sale.tapProduct(product)}
          />
          <CashierNewSaleTicket
            lines={sale.lines}
            ticketTotal={sale.ticketTotal}
            quote={sale.quote}
            phase={sale.phase}
            notes={sale.notes}
            onNotesChange={sale.setNotes}
            onSetQuantity={sale.setLineQuantity}
            onRemove={sale.removeLine}
            canUndo={sale.lastRemoved !== null}
            onUndo={sale.undoRemove}
            onReview={() => void sale.review()}
            disabled={reviewing}
          />
        </div>
      </div>
      {sale.sheetProduct && (
        <ProductCustomization
          product={sale.sheetProduct}
          isOpen
          onClose={sale.closeSheet}
          onConfirm={sale.confirmCustomization}
        />
      )}
    </CashierWorkspaceShell>
  );
}
