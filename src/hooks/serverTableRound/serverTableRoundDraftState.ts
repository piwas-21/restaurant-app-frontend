import type { OrderDto } from '@/types/order';
import type { OrderItem } from '@/components/catalog/orderItems';
import type { StaffCustomerSelection } from '@/types/staffCustomer';

export type RoundOperationState = 'idle' | 'committed' | 'failed' | 'unknown';

export interface ScopedDraftState {
  readonly scopeKey: string | null;
  readonly isReady: boolean;
  readonly storageBlocked: boolean;
  readonly items: OrderItem[];
  readonly notes: string;
  readonly customer?: StaffCustomerSelection;
  readonly operationId?: string;
  readonly quote: OrderDto | null;
  readonly createdOrder: OrderDto | null;
  readonly operationState: RoundOperationState;
  readonly draftRecovered: boolean;
}

export interface DraftIdentity {
  readonly tableId: string;
  readonly serviceSessionId: string;
  readonly staffUserId?: string;
}

export function emptyDraft(scopeKey: string | null): ScopedDraftState {
  return {
    scopeKey,
    isReady: false,
    storageBlocked: false,
    items: [],
    notes: '',
    customer: undefined,
    operationId: undefined,
    quote: null,
    createdOrder: null,
    operationState: 'idle',
    draftRecovered: false,
  };
}

export function invalidateRound(current: ScopedDraftState, change: Partial<ScopedDraftState>): ScopedDraftState {
  return {
    ...current,
    ...change,
    operationId: undefined,
    quote: null,
    createdOrder: null,
    operationState: 'idle',
  };
}
