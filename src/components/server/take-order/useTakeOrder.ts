import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createServerOrder } from '@/services/serverService';
import { CreateOrderItemDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { CustomizationResult } from '@/components/catalog/ProductCustomization';
import type { WaiterBundleCustomizationResult } from '../WaiterBundleCustomization';
import { OrderItem, addCustomizedItem, buildOrderItems } from '@/components/catalog/orderItems';
import { buildBundleOrderItem } from '@/components/catalog/bundleOrderItems';
import { useWaiterMenu } from './useWaiterMenu';

interface UseTakeOrderParams {
  tableNumber: string;
  onClose: () => void;
  onOrderCreated: () => void;
}

/**
 * The legacy create-order endpoint accepts an integer table number. Do not let parseInt turn a
 * display label such as "12A" or "T-QA" into a different table, and do not submit NaN for an
 * alphanumeric floor label that the current contract cannot represent.
 */
export function parseServerTableNumber(tableNumber: string): number | null {
  const normalized = tableNumber.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** State + behaviour for the take-order flow, consumed by the orchestrator + panels. */
export function useTakeOrder({ tableNumber, onClose, onOrderCreated }: UseTakeOrderParams) {
  const { t } = useTranslation();
  const menu = useWaiterMenu();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const orderSubtotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [orderItems],
  );
  const orderTotal = orderSubtotal;

  const handleCustomizationConfirm = (result: CustomizationResult) => {
    const product = menu.selectedProductForCustomization;
    if (!product) return;
    setOrderItems((previous) => addCustomizedItem(previous, product, result));
    menu.setSelectedProductForCustomization(null);
  };

  const handleBundleCustomizationConfirm = (result: WaiterBundleCustomizationResult) => {
    const bundle = menu.selectedBundleForCustomization;
    if (!bundle) return;
    const product = menu.products.find((candidate) => candidate.id === bundle.id);
    if (!product) return;
    setOrderItems((previous) => [...previous, buildBundleOrderItem(product, bundle, result)]);
    menu.setSelectedBundleForCustomization(null);
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) setOrderItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    else
      setOrderItems((previous) =>
        previous.map((item, itemIndex) => (itemIndex === index ? { ...item, quantity } : item)),
      );
  };
  const removeItem = (index: number) =>
    setOrderItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      menu.setError('Please add at least one item to the order');
      return;
    }
    const numericTableNumber = parseServerTableNumber(tableNumber);
    if (numericTableNumber === null) {
      menu.setError(t('server.invalid_table_label', 'This table label cannot be used for waiter orders yet.'));
      return;
    }
    try {
      setIsSubmitting(true);
      menu.setError(null);
      const items: CreateOrderItemDto[] = buildOrderItems(orderItems);
      await createServerOrder(numericTableNumber, items, customerName || undefined, orderNotes || undefined);
      onOrderCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create order:', err);
      menu.setError(getErrorMessage(err) ?? 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    ...menu,
    orderItems,
    customerName,
    setCustomerName,
    orderNotes,
    setOrderNotes,
    isSubmitting,
    orderSubtotal,
    orderTotal,
    handleCustomizationConfirm,
    handleBundleCustomizationConfirm,
    updateQuantity,
    removeItem,
    handleSubmit,
  };
}
