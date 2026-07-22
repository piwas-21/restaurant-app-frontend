/**
 * Server flow — tables + day's reservations (used by table-status view).
 * Split from `serverService.ts` (Sprint 2 frontend baseline ratchet).
 */

import { apiClient } from '@/utils/apiClient';
import { OrderDto } from '@/types/order';
import { TableDto, ReservationDto, ApiResponse, PagedResult as ReservationPagedResult } from '@/types/reservation';
import { getDineInOrders } from './orders';

const RESERVATION_IMMINENT_WINDOW_MS = 30 * 60 * 1000;

/** Extended table with current order + reservation context for the server view. */
export interface ServerTableDto extends TableDto {
  currentOrders: OrderDto[];
  orderCount: number;
  hasActiveOrders: boolean;
  upcomingReservation?: ReservationDto;
  status: 'available' | 'occupied' | 'reserved' | 'closed';
}

/** All tables, including closed ones so servers can reopen them. */
export async function getTables(): Promise<TableDto[]> {
  const response = await apiClient.get<ApiResponse<TableDto[]>>('/api/tables');
  return response.data || [];
}

/** Today's confirmed reservations (used internally by `getTablesWithStatus`). */
export async function getUpcomingReservations(): Promise<ReservationPagedResult<ReservationDto>> {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiClient.get<ApiResponse<ReservationPagedResult<ReservationDto>>>(
    `/api/reservations?date=${today}&status=1&pageSize=50`, // status=1 is Confirmed
  );

  return response.data || { items: [], totalCount: 0, page: 1, pageSize: 50, totalPages: 0 };
}

export async function getTablesWithStatus(): Promise<ServerTableDto[]> {
  const [tables, ordersResult, reservationsResult] = await Promise.all([
    getTables(),
    getDineInOrders({ status: 'Pending,Confirmed,Preparing,Ready', pageSize: 100 }),
    getUpcomingReservations(),
  ]);

  const orders = ordersResult.items || [];
  const reservations = reservationsResult.items || [];
  const now = new Date();
  const imminentDeadline = new Date(now.getTime() + RESERVATION_IMMINENT_WINDOW_MS);

  return tables.map((table) => {
    const tableOrders = orders.filter((order) => order.tableNumber?.toString() === table.tableNumber);
    const upcomingReservation = reservations.find((res) => res.tableId === table.id);

    let status: ServerTableDto['status'] = 'available';
    if (!table.isActive) {
      status = 'closed';
    } else if (tableOrders.length > 0) {
      status = 'occupied';
    } else if (upcomingReservation) {
      const reservationTime = new Date(`${upcomingReservation.reservationDate}T${upcomingReservation.startTime}`);
      if (reservationTime <= imminentDeadline) {
        status = 'reserved';
      }
    }

    return {
      ...table,
      currentOrders: tableOrders,
      orderCount: tableOrders.length,
      hasActiveOrders: tableOrders.length > 0,
      upcomingReservation,
      status,
    };
  });
}

async function setTableActive(tableId: string, isActive: boolean, errorMessage: string): Promise<TableDto> {
  const tableResponse = await apiClient.get<ApiResponse<TableDto>>(`/api/tables/${tableId}`);
  if (!tableResponse.data) {
    throw new Error('Table not found');
  }

  const table = tableResponse.data;
  const response = await apiClient.put<ApiResponse<TableDto>>(
    `/api/tables/${tableId}`,
    {
      tableNumber: table.tableNumber,
      maxGuests: table.maxGuests,
      isActive,
      isOutdoor: table.isOutdoor,
      positionX: table.positionX,
      positionY: table.positionY,
      notes: table.notes,
    },
    { requireAuth: true },
  );

  if (!response.success || !response.data) {
    throw new Error(response.message || errorMessage);
  }

  return response.data;
}

export async function closeTable(tableId: string): Promise<TableDto> {
  return setTableActive(tableId, false, 'Failed to close table');
}

export async function openTable(tableId: string): Promise<TableDto> {
  return setTableActive(tableId, true, 'Failed to open table');
}

/** Release a reservation hold so the table is bookable again. */
export async function releaseTable(tableNumber: string): Promise<boolean> {
  const response = await apiClient.post<ApiResponse<boolean>>(
    `/api/tables/${tableNumber}/release`,
    {},
    { requireAuth: true },
  );

  if (!response.success) {
    throw new Error(response.message || 'Failed to release table');
  }

  return response.data || true;
}
