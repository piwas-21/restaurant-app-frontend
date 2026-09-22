/** Additive mirror of the durable printer-routing projection on OrderDto. */
export interface OrderRoutingStateDto {
  id: string;
  jobId: string;
  revision: number;
  target: string;
  status: string;
  deviceId?: string | null;
  failureReason?: string | null;
  lastAcknowledgedAt?: string | null;
  version: number;
  isRequired: boolean;
}
