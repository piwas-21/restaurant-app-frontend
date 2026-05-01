'use client';

import { LucideIcon } from 'lucide-react';
import { OrderType } from '@/types/order';
import styles from '@/app/styles/OrderTypePage.module.css';

export interface OrderTypeOption {
  type: OrderType;
  icon: LucideIcon;
  title: string;
  description: string;
}

interface OrderTypeCardsProps {
  options: OrderTypeOption[];
  selected: OrderType | null;
  onSelect: (type: OrderType) => void;
}

/**
 * Three-button grid for choosing dine-in / takeaway / delivery. Pure
 * presentational — selection state lives in the parent.
 */
export default function OrderTypeCards({ options, selected, onSelect }: OrderTypeCardsProps) {
  return (
    <div className={styles.orderTypes}>
      {options.map(({ type, icon: Icon, title, description }) => (
        <button
          key={type}
          className={`${styles.orderTypeCard} ${selected === type ? styles.selected : ''}`}
          onClick={() => onSelect(type)}
        >
          <Icon className={styles.orderTypeIcon} size={48} />
          <h2 className={styles.orderTypeTitle}>{title}</h2>
          <p className={styles.orderTypeDescription}>{description}</p>
        </button>
      ))}
    </div>
  );
}
