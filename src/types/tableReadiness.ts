export interface TableReadinessProjection {
  readonly readinessState?: string | null;
  readonly readinessVersion?: number | null;
}

export interface TableReadinessRequest {
  readonly operationId: string;
  readonly expectedReadinessVersion: number;
}

export interface TableReadinessOutcome {
  readonly tableId: string;
  readonly operationId: string;
  readonly readinessState: 'ReadyForGuests';
  readonly readinessVersion: number;
}

export type TableReadinessResult =
  | { readonly kind: 'succeeded'; readonly outcome: TableReadinessOutcome }
  | { readonly kind: 'refused'; readonly code: string; readonly terminal: boolean };

export interface PendingTableReadiness {
  readonly actorId: string;
  readonly actorRole: 'Admin' | 'Cashier' | 'Server';
  readonly tableId: string;
  readonly request: TableReadinessRequest;
}
