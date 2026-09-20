import { OrderType } from '@/types/order';
import { apiClient } from '@/utils/apiClient';

/**
 * API Response wrapper
 */
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

/**
 * How an order type confirms (order confirmation flows, backend S1):
 * - `direct`: today's behaviour — the order is confirmed the moment it is placed.
 * - `acknowledge`: the order starts Pending and a staff member reviews + approves it.
 */
export type ConfirmationFlow = 'direct' | 'acknowledge';

export const DEFAULT_REVIEW_WINDOW_MINUTES = 2;
export const MIN_REVIEW_WINDOW_MINUTES = 1;
export const MAX_REVIEW_WINDOW_MINUTES = 60;

export interface OrderTypeConfigurationDto {
  orderType: OrderType;
  isEnabled: boolean;
  displayOrder: number;
  confirmationFlow?: ConfirmationFlow;
  reviewWindowMinutes?: number;
}

export interface UpdateOrderTypeConfigurationDto {
  orderType: OrderType;
  isEnabled: boolean;
  /** Omitted leaves the stored value (backend under-posting contract) — DineIn rows send neither field. */
  confirmationFlow?: ConfirmationFlow;
  reviewWindowMinutes?: number;
}

/** One row of the anonymous per-type confirmation read the guest screen renders from. */
export interface OrderTypeConfirmationPublicDto {
  orderType: OrderType;
  confirmationFlow: string;
  reviewWindowMinutes: number;
}

const ENDPOINTS = {
  GET_ALL: '/api/OrderTypeConfiguration',
  GET_ENABLED: '/api/OrderTypeConfiguration/enabled',
  GET_PUBLIC_CONFIRMATIONS: '/api/ordertypeconfiguration/public',
  UPDATE: '/api/OrderTypeConfiguration',
};

export const orderTypeConfigurationService = {
  /**
   * Get all order type configurations (admin only)
   */
  async getAll(): Promise<OrderTypeConfigurationDto[]> {
    const response = await apiClient.get<ApiResponse<OrderTypeConfigurationDto[]>>(ENDPOINTS.GET_ALL);
    return response.data;
  },

  /**
   * Get enabled order types (public endpoint)
   */
  async getEnabled(): Promise<OrderType[]> {
    const response = await apiClient.get<ApiResponse<OrderType[]>>(ENDPOINTS.GET_ENABLED);
    return response.data;
  },

  /**
   * Get the per-type confirmation flow + review window (public endpoint, backend S1).
   * The guest confirmation screen reads the review window from here so it can size its
   * animation without an authenticated call.
   */
  async getPublicConfirmationConfigurations(): Promise<OrderTypeConfirmationPublicDto[]> {
    const response = await apiClient.get<ApiResponse<OrderTypeConfirmationPublicDto[]>>(
      ENDPOINTS.GET_PUBLIC_CONFIRMATIONS,
    );
    return response.data ?? [];
  },

  /**
   * Update order type configuration (admin only)
   */
  async update(dto: UpdateOrderTypeConfigurationDto): Promise<OrderTypeConfigurationDto> {
    const response = await apiClient.put<ApiResponse<OrderTypeConfigurationDto>>(ENDPOINTS.UPDATE, dto);
    return response.data;
  },
};

/** Resolve one type directly from the public endpoint when the page-level prefetch is not ready. */
export async function resolvePublicConfirmationFlow(orderType: OrderType): Promise<ConfirmationFlow> {
  try {
    const rows = await orderTypeConfigurationService.getPublicConfirmationConfigurations();
    return rows.find((row) => row.orderType === orderType)?.confirmationFlow === 'acknowledge'
      ? 'acknowledge'
      : 'direct';
  } catch (error) {
    // Compatibility-safe failure: never opt an existing tenant into acknowledge UI when its
    // configuration cannot be read, but retain observability for operators.
    console.warn('Failed to resolve public order confirmation flow', error);
    return 'direct';
  }
}
