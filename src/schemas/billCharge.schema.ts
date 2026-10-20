import { z } from 'zod';
import {
  MAX_BILL_CHARGE_AMOUNT,
  MAX_BILL_CHARGE_FIELDS,
  BILL_CHARGE_KEY_MAX_LENGTH,
  BILL_CHARGE_LABEL_MAX_LENGTH,
  BILL_CHARGE_KEY_PATTERN,
} from '@/lib/billChargeLimits';

const key = z.string().max(BILL_CHARGE_KEY_MAX_LENGTH).regex(BILL_CHARGE_KEY_PATTERN);
export const billChargeAmountSchema = z.number().finite().min(0).max(MAX_BILL_CHARGE_AMOUNT);
const modes = {
  effect: z.enum(['Increase', 'Reduce']).optional(),
  calculation: z.enum(['Fixed', 'Percentage']).optional(),
};
// Draft metadata is advisory; the server resolves the saved rule for every accepted adjustment.
export const billChargeInputSchema = z.object({ key, amount: billChargeAmountSchema, ...modes });
export const billChargeRuleSchema = z
  .object({
    key,
    ...modes,
    label: z.string().trim().min(1).max(BILL_CHARGE_LABEL_MAX_LENGTH),
    enabled: z.boolean(),
    defaultAmount: billChargeAmountSchema,
    allowCustomAmount: z.boolean(),
    orderTypes: z.array(z.enum(['DineIn', 'Takeaway', 'Delivery'])).min(1),
    roles: z.array(z.enum(['Cashier', 'Server'])).min(1),
  })
  .refine((rule) => rule.calculation !== 'Percentage' || rule.defaultAmount <= 100);
export const billChargeSettingsSchema = z.object({
  rules: z
    .array(billChargeRuleSchema)
    .max(MAX_BILL_CHARGE_FIELDS)
    .refine((rules) => new Set(rules.map((rule) => rule.key)).size === rules.length),
});
export type BillChargeSettingsForm = z.infer<typeof billChargeSettingsSchema>;
export type BillChargeRuleValues = z.infer<typeof billChargeRuleSchema>;
