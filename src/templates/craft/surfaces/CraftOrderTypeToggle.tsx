'use client';

import React from 'react';
import { OrderType } from '@/types/order';
import OrderTypeToggleShell from '@/components/order/OrderTypeToggleShell';
import styles from './CraftOrderTypeToggle.module.css';

interface CraftOrderTypeToggleProps {
  /** Fired when the user clicks a type; host wires it to pickType. */
  onPick: (type: OrderType) => void;
}

/**
 * Craft order-type picker (cart surface, S15 T4). Same behaviour/data as the
 * shared `OrderTypeToggle` (both wrap `OrderTypeToggleShell`) but rendered as
 * hand-torn kraft chips — the active one terracotta — to match the order-pad
 * look. Craft-only bundle (rendered by `CraftCartContents`).
 */
function CraftOrderTypeToggleImpl({ onPick }: Readonly<CraftOrderTypeToggleProps>) {
  return <OrderTypeToggleShell onPick={onPick} styles={styles} />;
}

const CraftOrderTypeToggle = React.memo(CraftOrderTypeToggleImpl);
export default CraftOrderTypeToggle;
