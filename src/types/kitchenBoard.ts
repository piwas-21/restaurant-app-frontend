import type { ApiResponse } from '@/types/order/common';

export type KitchenBoardStreamMode = 'Snapshot' | 'Changes' | 'Watermark';
export type KitchenBoardWorkKind = 'InitialOrder' | 'AmendmentCorrection';

export interface KitchenBoardIngredient {
  readonly ingredientId: string;
  readonly ingredientName: string;
  readonly quantity: number;
  readonly isRemoved: boolean;
  readonly isAddOn: boolean;
}

export interface KitchenBoardItem {
  readonly itemId: string;
  readonly productName: string;
  readonly variationName: string | null;
  readonly quantity: number;
  readonly kind: string | null;
  readonly specialInstructions: string | null;
  readonly ingredients: readonly KitchenBoardIngredient[];
  readonly children: readonly KitchenBoardItem[];
}

export interface KitchenBoardRoute {
  readonly target: string;
  readonly status: string;
}

export interface KitchenBoardOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly type: string;
  readonly status: string;
  readonly tableId: string | null;
  readonly tableLabel: string | null;
  readonly tableNumber: number | null;
  readonly serviceSessionId: string | null;
  readonly createdAt: string;
  readonly version: number;
  readonly isCompleted: boolean;
  readonly completedAt: string | null;
  readonly canComplete: boolean;
  readonly requiredKitchenRoutes: readonly KitchenBoardRoute[];
  readonly items: readonly KitchenBoardItem[];
}

export interface KitchenBoardChange {
  readonly kind: string;
  readonly replacementDispatchedOrderId: string | null;
  readonly replacementDispatchedOrderNumber: string | null;
  readonly previous: KitchenBoardItem | null;
  readonly current: KitchenBoardItem | null;
}

export interface KitchenBoardCorrection {
  readonly workItemId: string;
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly tableId: string | null;
  readonly tableLabel: string | null;
  readonly tableNumber: number | null;
  readonly serviceSessionId: string | null;
  readonly amendmentId: string | null;
  readonly accountRevision: number | null;
  /** Version observed when this exact work item was projected, including terminal orders. */
  readonly orderVersion: number;
  readonly target: string | null;
  readonly summary: string;
  readonly withdrawn: boolean;
  readonly isCompleted: boolean;
  readonly canComplete: boolean;
  readonly routeStatus: string | null;
  readonly createdAt: string;
  readonly changes: readonly KitchenBoardChange[];
}

export interface KitchenBoardCompletion {
  readonly orderId: string;
  readonly workItemId: string;
  readonly kind: KitchenBoardWorkKind;
  readonly accountRevision: number | null;
  readonly acknowledgedOrderVersion: number;
  readonly sequence: number;
  readonly completedAt: string;
}

export interface KitchenBoardPage<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
  readonly hasMore: boolean;
  readonly removedIds: readonly string[];
  readonly nextCursor: string | null;
  readonly watermark: number;
  readonly mode: KitchenBoardStreamMode;
}

export interface KitchenBoardWorkFeed {
  readonly orders: KitchenBoardPage<KitchenBoardOrder>;
  readonly corrections: KitchenBoardPage<KitchenBoardCorrection>;
  readonly completions: KitchenBoardPage<KitchenBoardCompletion>;
}

export interface KitchenBoardCursors {
  readonly orders: string | null;
  readonly corrections: string | null;
  readonly completions: string | null;
}

export interface GetKitchenBoardWorkOptions extends Partial<KitchenBoardCursors> {
  readonly pageSize?: number;
}

export interface CompleteKitchenBoardWorkRequest {
  readonly kind: KitchenBoardWorkKind;
  readonly expectedOrderVersion: number;
  readonly expectedAccountRevision: number | null;
}

export interface CompleteKitchenBoardWorkResult extends KitchenBoardCompletion {
  readonly isCompleted: true;
}

export type KitchenBoardWorkFeedApiResponse = ApiResponse<KitchenBoardWorkFeed>;
export type CompleteKitchenBoardWorkApiResponse = ApiResponse<CompleteKitchenBoardWorkResult>;
