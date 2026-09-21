import { z } from 'zod';

export const customMinutesSchema = z.object({ minutes: z.coerce.number().int().min(1).max(600) });
export const PRESET_MINUTES = [15, 30, 45];

export function channelLabel(type: string, translate: (key: string) => string): string {
  if (type === 'DineIn') return translate('cashier.workspace.channel_dine_in');
  if (type === 'Delivery') return translate('cashier.workspace.channel_delivery');
  if (type === 'Takeaway') return translate('cashier.workspace.channel_takeaway');
  return type;
}
