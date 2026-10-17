import type { OrderType } from '@/types/order';
import type { CashierNewSaleDraftLine } from '@/lib/cashierNewSaleDraft';
import type { CashierNewSaleContact } from '@/lib/cashierNewSaleContact';

export interface NewSaleDraftState {
  channel: OrderType | null;
  lines: CashierNewSaleDraftLine[];
  notes: string;
  billCharges?: import('@/types/billCharge').BillChargeInput[];
  tableNumber: string;
  tableId?: string;
  serviceSessionId?: string;
  contact?: CashierNewSaleContact;
  clientOperationId?: string;
}

export const EMPTY_NEW_SALE_STATE: NewSaleDraftState = { channel: null, lines: [], notes: '', tableNumber: '' };
