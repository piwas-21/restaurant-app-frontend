/** Additive mirror of the durable printer-routing projection on OrderDto. */
export type DevicePrintTarget = string;
export type DevicePrintStatus = string;

export interface OrderRoutingStateDto {
  id: string;
  jobId: string;
  revision: number;
  target: DevicePrintTarget;
  status: DevicePrintStatus;
  deviceId?: string | null;
  failureReason?: string | null;
  lastAcknowledgedAt?: string | null;
  version: number;
  isRequired: boolean;
}
