/** Additive mirror of the backend ExternalOrderDto; no provider credentials or internal IDs. */
export interface ExternalOrderDto {
  provider: string;
  externalDisplayId: string;
  externalState: string;
  lastEventAt: string;
  currency: string;
  merchantTotal: number;
  reportedTax: number | null;
  fulfillmentType: string;
  isSandbox: boolean;
}
