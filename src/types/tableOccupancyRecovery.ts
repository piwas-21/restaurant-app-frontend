export type TableOccupancyRecoveryDisposition = 'CancelledUnsent' | 'ArchivedLegacyOccupancy' | 'RetainedInPriorVisit';

export interface TableOccupancyRecoveryOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly disposition: TableOccupancyRecoveryDisposition;
  readonly originalStatus: string;
  readonly originalPaymentStatus: string;
  readonly originalTotal: number;
  readonly originalBillingCreditAmount: number;
  readonly originalTotalPaid: number;
  readonly originalRemainingAmount: number;
  readonly wasLegacyUnassigned: boolean;
  readonly wasKitchenReleased: boolean;
  readonly hadRoutingHistory: boolean;
}

interface TableOccupancyRecoveryBase {
  readonly tableId: string;
  readonly tableNumber: string;
  readonly serviceSessionId: string | null;
  readonly readinessVersion: number;
  readonly currency: string | null;
  readonly orders: readonly TableOccupancyRecoveryOrder[];
}

export interface TableOccupancyRecoveryPreview extends TableOccupancyRecoveryBase {
  readonly sessionVersion: number | null;
  readonly accountRevision: number | null;
  readonly previewFingerprint: string;
  readonly orderCount: number;
  readonly cancelableUnsentCount: number;
  readonly legacyUnassignedCount: number;
  readonly routedOrderCount: number;
  readonly preparingOrderCount: number;
  readonly readyOrderCount: number;
  readonly paidOrRefundedOrderCount: number;
  readonly activePaymentAttemptCount: number;
  readonly pendingPaymentHandoffCount: number;
  readonly checkoutAttemptCount: number;
  readonly preservedOutstandingAmount: number;
}

export interface TableOccupancyRecoveryOperation extends Omit<TableOccupancyRecoveryBase, 'tableNumber' | 'currency'> {
  readonly operationId: string;
  readonly reason: string;
  readonly recordedAt: string;
  readonly visitReleasedAt: string | null;
  readonly readinessState: string;
  readonly sessionVersion: number | null;
  readonly accountRevision: number | null;
  readonly cancelledUnsentCount: number;
  readonly archivedLegacyCount: number;
  readonly retainedPriorVisitCount: number;
  readonly preservedPaidAmount: number;
  readonly preservedOutstandingAmount: number;
}

export interface RecoverTableOccupancyRequest {
  readonly operationId: string;
  readonly serviceSessionId: string | null;
  readonly expectedReadinessVersion: number;
  readonly expectedSessionVersion: number | null;
  readonly expectedAccountRevision: number | null;
  readonly previewFingerprint: string;
  readonly confirmRecovery: true;
  readonly reason: string;
}

export interface PendingTableOccupancyRecovery {
  readonly actorId: string;
  readonly actorRole: 'Admin' | 'Cashier' | 'Server';
  readonly tableId: string;
  readonly currency: string | null;
  readonly request: RecoverTableOccupancyRequest;
}
