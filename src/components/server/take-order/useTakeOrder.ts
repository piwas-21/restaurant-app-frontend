import { useMemo, useState } from 'react';
import { createServerOrder, UserDto, calculateDiscountFromPoints } from '@/services/serverService';
import { CreateOrderItemDto } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { CustomizationResult } from '../ProductCustomization';
import type { WaiterBundleCustomizationResult } from '../WaiterBundleCustomization';
import { OrderItem, addCustomizedItem, buildOrderItems } from './orderItems';
import { buildBundleOrderItem } from './bundleOrderItems';
import { useWaiterMenu } from './useWaiterMenu';

interface UseTakeOrderParams {
  tableNumber: string;
  onClose: () => void;
  onOrderCreated: () => void;
}

/** State + behaviour for the take-order flow, consumed by the orchestrator + panels. */
export function useTakeOrder({ tableNumber, onClose, onOrderCreated }: UseTakeOrderParams) {
  const menu = useWaiterMenu();
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const orderSubtotal = useMemo(
    () => orderItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [orderItems],
  );
  const pointsDiscount = useMemo(() => calculateDiscountFromPoints(pointsToRedeem), [pointsToRedeem]);
  const orderTotal = useMemo(() => Math.max(0, orderSubtotal - pointsDiscount), [orderSubtotal, pointsDiscount]);

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

  const handleUserSelect = (user: UserDto | null) => {
    setSelectedUser(user);
    setPointsToRedeem(0);
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
    try {
      setIsSubmitting(true);
      menu.setError(null);
      const items: CreateOrderItemDto[] = buildOrderItems(orderItems);
      await createServerOrder(
        Number.parseInt(tableNumber, 10),
        items,
        customerName || undefined,
        orderNotes || undefined,
        selectedUser?.id,
        pointsToRedeem > 0 ? pointsToRedeem : undefined,
      );
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
    selectedUser,
    handleUserSelect,
    pointsToRedeem,
    setPointsToRedeem,
    orderSubtotal,
    orderTotal,
    handleCustomizationConfirm,
    handleBundleCustomizationConfirm,
    updateQuantity,
    removeItem,
    handleSubmit,
  };
}
