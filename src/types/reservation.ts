export enum ReservationStatus {
  Pending = 0,
  Confirmed = 1,
  Cancelled = 2,
  Completed = 3,
  NoShow = 4,
}

export const ReservationStatusLabel: Record<ReservationStatus, string> = {
  [ReservationStatus.Pending]: 'Pending',
  [ReservationStatus.Confirmed]: 'Confirmed',
  [ReservationStatus.Cancelled]: 'Cancelled',
  [ReservationStatus.Completed]: 'Completed',
  [ReservationStatus.NoShow]: 'NoShow',
};

// Shape/size/rotation removed 2026-07-23 (uniform table marker — see
// docs/plans/RESERVATIONS-REVAMP-PLAN.md §3.2). The backend keeps returning
// the legacy fields until its own cleanup PR; extra JSON props are harmless.
export interface TableDto {
  id: string;
  tableNumber: string;
  maxGuests: number;
  isActive: boolean;
  isOutdoor: boolean;
  positionX: number;
  positionY: number;
  notes?: string;
  qrCodeData?: string;
  qrCodeGeneratedAt?: string;
}

export interface ReservationDto {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  tableId: string;
  tableNumber: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  numberOfGuests: number;
  status: ReservationStatus;
  specialRequests?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateReservationDto {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  tableId: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  numberOfGuests: number;
  specialRequests?: string | null;
}

/**
 * The customer-safe self-update body — `PUT /api/reservations/{id}/mine`.
 *
 * Deliberately NOT `CreateReservationDto` and NOT the admin `UpdateReservationDto`: it carries
 * neither `status` (a guest must not confirm their own booking, nor mark it NoShow) nor `tableId`
 * (the server re-seats the party). Ownership is read from the bearer token, not from the body.
 * `startTime`/`endTime` are `"HH:mm:ss"` LOCAL wall-clock strings — the backend binds them to
 * `TimeSpan`, which an ISO datetime does not parse into, and converting to UTC first moves the
 * booking by the offset (the defect the mobile client hit).
 */
export interface UpdateMyReservationDto {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  numberOfGuests: number;
  specialRequests?: string | null;
}

export interface TimeSlotDto {
  startTime: string;
  endTime: string;
  availableTables: TableDto[];
}

export interface AvailableTimeSlotsDto {
  date: string;
  timeSlots: TimeSlotDto[];
}

export interface ReservationFormData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  numberOfGuests: number;
  reservationDate: Date;
  selectedTimeSlot?: TimeSlotDto;
  selectedTable?: TableDto;
  specialRequests: string;
}

export interface CreateTableDto {
  tableNumber: string;
  maxGuests: number;
  isActive?: boolean;
  isOutdoor?: boolean;
  positionX?: number;
  positionY?: number;
  notes?: string;
}

export interface UpdateTableDto {
  tableNumber: string;
  maxGuests: number;
  isActive: boolean;
  isOutdoor: boolean;
  positionX: number;
  positionY: number;
  notes?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
}
