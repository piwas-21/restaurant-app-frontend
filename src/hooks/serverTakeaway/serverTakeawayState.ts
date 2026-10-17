import type { OrderItem } from '@/components/catalog/orderItems';
export type ReviewPhase = 'idle' | 'reviewing';
export type OperationState = 'idle' | 'committed' | 'failed';
export const EMPTY_ITEMS: OrderItem[] = [];
