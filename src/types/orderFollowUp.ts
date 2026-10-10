import type { OrderType } from './order';

/** Only an explicit checkout action may resume after collecting missing details. */
export type OrderTypePickHandler = (
  type: OrderType,
  source?: string,
  forceModal?: boolean,
  intent?: 'checkout',
) => void | Promise<void>;
