// Reservation Service - API client for reservation operations
import { apiClient } from '@/utils/apiClient';
import { serverMessages, throwServerRefusal } from '@/utils/apiFormErrors';
import {
  TableDto,
  ReservationDto,
  CreateReservationDto,
  CreateTableDto,
  UpdateTableDto,
  AvailableTimeSlotsDto,
  ReservationStatus,
  ApiResponse,
  PagedResult,
} from '@/types/reservation';

// Helper function to map string status from API to enum
function mapStatusToEnum(status: string | ReservationStatus): ReservationStatus {
  if (typeof status === 'number') {
    return status;
  }

  const statusMap: Record<string, ReservationStatus> = {
    Pending: ReservationStatus.Pending,
    Confirmed: ReservationStatus.Confirmed,
    Cancelled: ReservationStatus.Cancelled,
    Completed: ReservationStatus.Completed,
    NoShow: ReservationStatus.NoShow,
    'No-Show': ReservationStatus.NoShow,
  };

  return statusMap[status] ?? ReservationStatus.Pending;
}

export const reservationService = {
  // Tables
  async getTables(isActive?: boolean, isOutdoor?: boolean): Promise<TableDto[]> {
    const params = new URLSearchParams();
    if (isActive !== undefined) params.append('isActive', String(isActive));
    if (isOutdoor !== undefined) params.append('isOutdoor', String(isOutdoor));

    const response = await apiClient.get<ApiResponse<TableDto[]>>(`/api/tables?${params}`);
    return response.data || [];
  },

  async getTableById(id: string): Promise<TableDto> {
    const response = await apiClient.get<ApiResponse<TableDto>>(`/api/tables/${id}`);
    if (!response.data) {
      throw new Error('Table not found');
    }
    return response.data;
  },

  async createTable(data: CreateTableDto): Promise<TableDto> {
    const response = await apiClient.post<ApiResponse<TableDto>>('/api/tables', data);
    if (!response.success || !response.data) {
      throwServerRefusal(response);
    }
    return response.data;
  },

  async updateTable(id: string, data: UpdateTableDto): Promise<TableDto> {
    const response = await apiClient.put<ApiResponse<TableDto>>(`/api/tables/${id}`, data);
    if (!response.success || !response.data) {
      throwServerRefusal(response);
    }
    return response.data;
  },

  async deleteTable(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<boolean>>(`/api/tables/${id}`);
    if (!response.success) {
      throwServerRefusal(response);
    }
  },

  // Reservations
  async getReservations(params?: {
    date?: string;
    tableId?: string;
    status?: ReservationStatus;
    page?: number;
    pageSize?: number;
  }): Promise<PagedResult<ReservationDto>> {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.tableId) queryParams.append('tableId', params.tableId);
    if (params?.status !== undefined) queryParams.append('status', String(params.status));
    // Backend expects lowercase 'page' and 'pageSize'
    if (params?.page) queryParams.append('page', String(params.page));
    if (params?.pageSize) queryParams.append('pageSize', String(params.pageSize));

    const response = await apiClient.get<ApiResponse<PagedResult<any>>>(`/api/reservations?${queryParams}`);

    // Map string status to enum values
    const data = response.data;
    if (data && data.items) {
      data.items = data.items.map((item: any) => ({
        ...item,
        status: mapStatusToEnum(item.status),
      }));
    }

    return (
      data || {
        items: [],
        totalCount: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
      }
    );
  },

  async getAvailableTimeSlots(
    date: string,
    numberOfGuests: number,
  ): Promise<{
    data: AvailableTimeSlotsDto | null;
    error?: string;
    isCapacityIssue?: boolean;
  }> {
    const params = new URLSearchParams({
      date: date,
      numberOfGuests: String(numberOfGuests),
    });

    // No try/catch: a non-2xx is already an `ApiError` carrying the server's own account, and the
    // catch that used to be here rethrew it as `new Error(error.message || '<English>')` — losing
    // `status`, `errorCode`, `errors[]` and (since #401) `cause`, to say nothing more than the
    // ApiError already said. `useReservationAvailability.fetchTimeSlots` catches it.
    const response = await apiClient.get<ApiResponse<AvailableTimeSlotsDto>>(
      `/api/reservations/available-slots?${params}`,
    );

    if (!response.success || !response.data) {
      // `serverMessages` is the same errors-then-message precedence this hand-rolled chain had,
      // minus the bug: it drops BLANK entries, where `errors.length > 0` happily returned `''`
      // and the `isCapacityIssue` test below then ran on an empty string.
      //
      // Unlike the throw paths this one keeps a client-authored fallback, because `error` is read
      // as a FLAG as much as a message — `useReservationAvailability` tests it and clears the
      // slot list without ever rendering it.
      const errorMessage = serverMessages(response)[0] ?? 'Failed to fetch available time slots';

      // Check if it's a capacity issue (expected scenario)
      const isCapacityIssue = errorMessage.toLowerCase().includes('no tables available for');

      return {
        data: null,
        error: errorMessage,
        isCapacityIssue,
      };
    }

    return { data: response.data };
  },

  async createReservation(data: CreateReservationDto): Promise<ReservationDto> {
    const response = await apiClient.post<ApiResponse<any>>('/api/reservations', data);

    if (!response.success || !response.data) {
      throwServerRefusal(response);
    }

    // Map string status to enum
    return {
      ...response.data,
      status: mapStatusToEnum(response.data.status),
    };
  },

  async getReservationById(id: string): Promise<ReservationDto> {
    const response = await apiClient.get<ApiResponse<any>>(`/api/reservations/${id}`);
    if (!response.data) {
      throw new Error('Reservation not found');
    }

    // Map string status to enum
    return {
      ...response.data,
      status: mapStatusToEnum(response.data.status),
    };
  },

  async cancelReservation(id: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<boolean>>(`/api/reservations/${id}/cancel`);

    if (!response.success) {
      throwServerRefusal(response);
    }
  },

  async confirmReservation(id: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<boolean>>(`/api/reservations/${id}/confirm`);

    if (!response.success) {
      throwServerRefusal(response);
    }
  },

  async updateReservationStatus(id: string, status: ReservationStatus): Promise<void> {
    const response = await apiClient.put<ApiResponse<boolean>>(`/api/reservations/${id}/status`, { status });

    if (!response.success) {
      throwServerRefusal(response);
    }
  },

  async deleteReservation(id: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<boolean>>(`/api/reservations/${id}`);

    if (!response.success) {
      throwServerRefusal(response);
    }
  },

  // Helper functions
  formatTimeSlot(startTime: string, endTime: string): string {
    // Convert "HH:mm:ss" format to "HH:mm"
    const formatTime = (time: string) => {
      const parts = time.split(':');
      return `${parts[0]}:${parts[1]}`;
    };

    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  },

  getStatusLabel(status: ReservationStatus): string {
    const labels: Record<ReservationStatus, string> = {
      [ReservationStatus.Pending]: 'Pending',
      [ReservationStatus.Confirmed]: 'Confirmed',
      [ReservationStatus.Cancelled]: 'Cancelled',
      [ReservationStatus.Completed]: 'Completed',
      [ReservationStatus.NoShow]: 'No Show',
    };
    return labels[status] || 'Unknown';
  },

  getStatusColor(status: ReservationStatus): string {
    const colors: Record<ReservationStatus, string> = {
      [ReservationStatus.Pending]: '#f59e0b',
      [ReservationStatus.Confirmed]: '#10b981',
      [ReservationStatus.Cancelled]: '#ef4444',
      [ReservationStatus.Completed]: '#6b7280',
      [ReservationStatus.NoShow]: '#ef4444',
    };
    return colors[status];
  },
};
