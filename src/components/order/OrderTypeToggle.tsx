'use client';

import React from 'react';
import { OrderType } from '@/types/order';
import OrderTypeToggleShell from './OrderTypeToggleShell';
import styles from './OrderTypeToggle.module.css';

interface OrderTypeToggleProps {
  /**
   * Fired when the user clicks a type. Host typically wires this up to
   * `useOrderTypeFollowUp().pickType` so DineIn/Delivery clicks open the
   * relevant detail modal.
   */
  onPick: (type: OrderType) => void;
}

/**
 * Order-type segmented toggle for the desktop cart sidebar (classic look).
 * All behaviour lives in the shared `OrderTypeToggleShell`; this just supplies
 * the classic CSS module. Craft ships its own chip-styled wrapper over the same
 * shell.
 */
// Memoized so the `useCallback`-stabilised `onPick` from CartContents (PR #74
// review) actually prevents this child from re-rendering on parent re-renders.
function OrderTypeToggleImpl({ onPick }: OrderTypeToggleProps) {
  return <OrderTypeToggleShell onPick={onPick} styles={styles} />;
}

const OrderTypeToggle = React.memo(OrderTypeToggleImpl);
export default OrderTypeToggle;
