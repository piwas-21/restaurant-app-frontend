'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { useCheckout } from '@/contexts/CheckoutContext';
import { useCart } from '@/components/cart/CartContext';
import { useTableContext } from '@/contexts/TableContext';
import { OrderType } from '@/types/order';
import { Store, Utensils, Truck, ChevronRight } from 'lucide-react';
import TableSelector from '@/components/checkout/TableSelector';
import OrderTypeCards, { OrderTypeOption } from '@/components/checkout/order-type/OrderTypeCards';
import DeliveryAddressSection from '@/components/checkout/order-type/DeliveryAddressSection';
import { useDeliveryAddress } from '@/hooks/checkout/useDeliveryAddress';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import styles from '../../styles/OrderTypePage.module.css';

const EMPTY_ADDRESS = { street: '', city: '', postalCode: '', country: '' };

export default function OrderTypePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { state: checkoutState, setOrderType, setTableNumber, setDeliveryAddress } = useCheckout();
  const { state: cartState } = useCart();
  const { tableContext, hasTableContext } = useTableContext();

  const [selectedType, setSelectedType] = useState<OrderType | null>(checkoutState.orderType);
  const [tableNum, setTableNum] = useState(checkoutState.tableNumber || '');
  const [tableError, setTableError] = useState('');

  const { enabled: enabledOrderTypes, loading: loadingOrderTypes } = useEnabledOrderTypes();
  const address = useDeliveryAddress(checkoutState.deliveryAddress ?? undefined, selectedType === OrderType.Delivery);

  // QR-code table context auto-selects dine-in and pre-fills the table.
  useEffect(() => {
    if (hasTableContext && tableContext.tableNumber) {
      setSelectedType(OrderType.DineIn);
      setTableNum(tableContext.tableNumber);
      setOrderType(OrderType.DineIn);
      setTableNumber(tableContext.tableNumber);
    }
  }, [hasTableContext, tableContext, setOrderType, setTableNumber]);

  const orderTypes = useMemo<OrderTypeOption[]>(
    () => [
      {
        type: OrderType.DineIn,
        icon: Utensils,
        title: t('order_type_dine_in', 'Dine In'),
        description: t('order_type_dine_in_desc', 'Enjoy your meal at our restaurant'),
      },
      {
        type: OrderType.Takeaway,
        icon: Store,
        title: t('order_type_takeaway', 'Takeaway'),
        description: t('order_type_takeaway_desc', 'Pick up your order'),
      },
      {
        type: OrderType.Delivery,
        icon: Truck,
        title: t('order_type_delivery', 'Delivery'),
        description: t('order_type_delivery_desc', 'We deliver to your address'),
      },
    ],
    [t],
  );
  const availableOrderTypes = orderTypes.filter((ot) => enabledOrderTypes.includes(ot.type));

  const validateTableSelection = (): boolean => {
    if (!tableNum.trim()) {
      setTableError(t('table_not_selected', 'Please select a table'));
      return false;
    }
    setTableError('');
    return true;
  };

  const handleContinue = async () => {
    if (!selectedType) return;

    if (selectedType === OrderType.DineIn) {
      if (!validateTableSelection()) return;
      setTableNumber(tableNum);
      setDeliveryAddress(EMPTY_ADDRESS);
    } else if (selectedType === OrderType.Delivery) {
      if (!address.validate()) return;
      setDeliveryAddress(address.trimmed());
      setTableNumber('');
      if (!(await address.persistIfRequested())) return;
    } else {
      setTableNumber('');
      setDeliveryAddress(EMPTY_ADDRESS);
    }

    setOrderType(selectedType);
    router.push('/checkout/customer-info');
  };

  if (cartState.items.length === 0) {
    return (
      <main className={styles.container}>
        <div className={styles.emptyState}>
          <h1>{t('checkout_title', 'Checkout')}</h1>
          <p>{t('cart_empty_message', 'Your cart is empty')}</p>
          <button onClick={() => router.push('/menu')} className={styles.browseButton}>
            {t('cart_browse_menu_button', 'Browse Menu')}
          </button>
        </div>
      </main>
    );
  }

  if (loadingOrderTypes) {
    return (
      <main className={styles.container}>
        <div className={styles.emptyState}>
          <h1>{t('checkout_title', 'Checkout')}</h1>
          <p>{t('common.loading', 'Loading...')}</p>
        </div>
      </main>
    );
  }

  if (availableOrderTypes.length === 0) {
    return (
      <main className={styles.container}>
        <div className={styles.emptyState}>
          <h1>{t('checkout_title', 'Checkout')}</h1>
          <p>
            {t('no_order_types_available', 'No order types are currently available. Please contact the restaurant.')}
          </p>
          <button onClick={() => router.push('/menu')} className={styles.browseButton}>
            {t('cart_browse_menu_button', 'Browse Menu')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('select_order_type', 'Select Order Type')}</h1>
        <p className={styles.subtitle}>{t('select_order_type_desc', 'How would you like to receive your order?')}</p>

        <OrderTypeCards
          options={availableOrderTypes}
          selected={selectedType}
          onSelect={(type) => {
            setSelectedType(type);
            address.setAddressError('');
          }}
        />

        {selectedType === OrderType.DineIn && (
          <div className={styles.detailsSection}>
            <h3 className={styles.sectionTitle}>
              <Utensils size={20} />
              {t('select_your_table', 'Select your Table')}
            </h3>
            <TableSelector selectedTable={tableNum} onTableSelect={setTableNum} disabled={hasTableContext} />
            {tableError && <p className={styles.error}>{tableError}</p>}
            {hasTableContext && (
              <p className={styles.infoText}>{t('table_from_qr', 'Table number set from QR code scan')}</p>
            )}
          </div>
        )}

        {selectedType === OrderType.Delivery && <DeliveryAddressSection address={address} />}

        <div className={styles.actions}>
          <button onClick={() => router.back()} className={styles.backButton} disabled={address.savingAddress}>
            {t('back', 'Back')}
          </button>
          <button
            onClick={handleContinue}
            disabled={!selectedType || address.savingAddress}
            className={styles.continueButton}
          >
            {address.savingAddress ? t('saving', 'Saving...') : t('continue', 'Continue')}
            {!address.savingAddress && <ChevronRight size={20} />}
          </button>
        </div>
      </div>
    </main>
  );
}
