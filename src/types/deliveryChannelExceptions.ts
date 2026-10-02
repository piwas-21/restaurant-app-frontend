export interface DeliveryChannelException {
  readonly id: string;
  readonly kind: string;
  readonly severity: string;
  readonly status: string;
  readonly code: string;
  readonly title: string;
  readonly detail: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly providerOrderId: string | null;
  readonly localOrderId: string | null;
  readonly canReconcile: boolean;
  readonly automaticRetryBlocked: boolean;
}

export interface DeliveryChannelExceptionInbox {
  readonly items: readonly DeliveryChannelException[];
  readonly nextCursor: string | null;
  readonly checkedAt: string;
}

export interface DeliveryChannelReconcileResult {
  readonly operationId: string;
  readonly status: string;
  readonly code: string | null;
  readonly observedAt: string | null;
  readonly providerRequestSent: boolean;
}
