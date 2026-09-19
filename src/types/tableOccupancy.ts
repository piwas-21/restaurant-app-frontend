/** One active order shown in the staff table occupancy projection. */
export interface TableOccupantDto {
  customerName?: string | null;
  orderNumber?: string | null;
  orderDate: string;
  isLoggedInUser: boolean;
}

/** Additive table occupancy projection emitted by the staff table endpoint. */
export interface TableOccupancyDto {
  isReserved?: boolean;
  reservedUntil?: string | null;
  isOccupied?: boolean;
  activeOrderCount?: number;
  occupants?: readonly TableOccupantDto[] | null;
}
