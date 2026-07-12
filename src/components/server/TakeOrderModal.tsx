import ProductCustomization from './ProductCustomization';
import { useTranslation } from 'react-i18next';
import { useTakeOrder } from './take-order/useTakeOrder';
import TakeOrderMenuPanel from './take-order/TakeOrderMenuPanel';
import TakeOrderSummaryPanel from './take-order/TakeOrderSummaryPanel';
import styles from './TakeOrderModal.module.css';

interface TakeOrderModalProps {
  tableNumber: string;
  onClose: () => void;
  onOrderCreated: () => void;
}

export default function TakeOrderModal({ tableNumber, onClose, onOrderCreated }: TakeOrderModalProps) {
  const { t } = useTranslation();
  const order = useTakeOrder({ tableNumber, onClose, onOrderCreated });

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <div className={styles.headerInfo}>
              <h2>{t('server.take_order', 'Take Order')}</h2>
              <span className={styles.tableLabel}>
                {t('server.table', 'Table')} {tableNumber}
              </span>
            </div>
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>

          <div className={styles.content}>
            {/* Left Panel - Menu */}
            <TakeOrderMenuPanel
              searchQuery={order.searchQuery}
              onSearchChange={order.setSearchQuery}
              categories={order.categories}
              selectedCategory={order.selectedCategory}
              onSelectCategory={order.setSelectedCategory}
              isLoading={order.isLoading}
              filteredProducts={order.filteredProducts}
              onProductClick={order.handleProductClick}
            />

            {/* Right Panel - Order Summary */}
            <TakeOrderSummaryPanel
              error={order.error}
              customerName={order.customerName}
              onCustomerNameChange={order.setCustomerName}
              selectedUser={order.selectedUser}
              onUserSelect={order.handleUserSelect}
              orderSubtotal={order.orderSubtotal}
              pointsToRedeem={order.pointsToRedeem}
              onPointsChange={order.setPointsToRedeem}
              orderItems={order.orderItems}
              onUpdateQuantity={order.updateQuantity}
              onRemoveItem={order.removeItem}
              orderNotes={order.orderNotes}
              onOrderNotesChange={order.setOrderNotes}
              orderTotal={order.orderTotal}
              isSubmitting={order.isSubmitting}
              onSubmit={order.handleSubmit}
            />
          </div>
        </div>
      </div>

      {/* Product Customization Modal */}
      {order.selectedProductForCustomization && (
        <ProductCustomization
          product={order.selectedProductForCustomization}
          isOpen={!!order.selectedProductForCustomization}
          onClose={() => order.setSelectedProductForCustomization(null)}
          onConfirm={order.handleCustomizationConfirm}
        />
      )}
    </>
  );
}
