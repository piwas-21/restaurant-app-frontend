export interface TableGuestVisitIdentity {
  readonly serviceSessionId: string;
  readonly participantToken: string;
  readonly expiresAt: string;
  /** Local recovery hint bound to the validated QR used for this successful join. */
  readonly tableId?: string;
}

export interface TableGuestAdmissionCodeDto {
  readonly admissionCode: string;
  readonly expiresAt: string;
}

export interface TableGuestOrderDto {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly paymentStatus: string;
  readonly orderDate: string;
  readonly total: number;
  readonly totalPaid: number;
  readonly remainingAmount: number;
}

export interface TableGuestIngredientDto {
  readonly name: string;
  readonly quantity: number;
  readonly removed: boolean;
  readonly addOn: boolean;
}

export interface TableGuestItemDto {
  readonly itemId: string;
  readonly productName: string;
  readonly variationName?: string | null;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly itemTotal: number;
  readonly ingredientCustomizations: readonly TableGuestIngredientDto[];
  readonly sideItems: readonly TableGuestItemDto[];
}

export interface TableGuestAccountLineDto {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly unitCount: number;
  readonly item: TableGuestItemDto;
}

export interface TableGuestAccountDto {
  readonly serviceSessionId: string;
  readonly tableLabel?: string | null;
  readonly currency?: string | null;
  readonly accountRevision: number;
  readonly subTotal: number;
  readonly tax: number;
  readonly discount: number;
  readonly tip: number;
  readonly total: number;
  readonly totalPaid: number;
  readonly remaining: number;
  readonly credit: number;
  readonly orders: readonly TableGuestOrderDto[];
  readonly items: readonly TableGuestAccountLineDto[];
}

export interface TableGuestRoundRequest {
  readonly operationId: string;
  readonly expectedAccountRevision: number;
  readonly expectedBasketFingerprint: string;
}

export interface PendingTableGuestRound {
  readonly serviceSessionId: string;
  readonly operationId: string;
  readonly expectedAccountRevision: number;
  readonly expectedBasketFingerprint: string;
}

export type TableGuestVisitPhase = 'loading' | 'notJoined' | 'active' | 'ended' | 'unavailable' | 'storageUnavailable';

export interface TableGuestRoundAcknowledgement {
  readonly message: 'committed';
  readonly at: number;
}
