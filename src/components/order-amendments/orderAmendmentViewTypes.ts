export interface UnitRange {
  readonly startOrdinal: number;
  readonly quantity: number;
}

export interface ReplacementTarget extends UnitRange {
  readonly orderItemId: string;
}
