import type { OrderDto, ExternalOrderDto } from '@/types/order';

export type ChannelTranslate = (key: string, fallback: string) => string;

export function channelProviderName(source: ExternalOrderDto, t: ChannelTranslate): string {
  return source.provider === 'uber-eats' ? t('delivery_channels.uber_eats', 'Uber Eats') : source.provider;
}

/** Missing provider tax is unknown, including when the legacy bookkeeping field contains zero. */
export function reportedOrderTax(order: OrderDto): number | null {
  return order.externalOrder ? (order.externalOrder.reportedTax ?? null) : order.tax;
}

/** Ordinary local workflow cannot decide a provider-managed order. */
export function permitsChannelLocalAction(order: OrderDto, action: string): boolean {
  return (
    !order.externalOrder || order.permittedActions?.some((entry) => entry.action === action && entry.allowed) === true
  );
}
