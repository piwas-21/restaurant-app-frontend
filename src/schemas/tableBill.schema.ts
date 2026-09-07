import { z } from 'zod';
import { PaymentMethod } from '@/types/order';

/**
 * The table-bill form's two user inputs. Error values are i18n keys, per the
 * house convention (schemas never carry prose; the dialog maps keys through `t`).
 *
 * The BILL's balance is NOT client-validated beyond this ceiling check: the
 * server owns the authoritative remaining (it can change under the dialog) and
 * refuses an over-tender with a message the dialog renders verbatim.
 */
export const tableNumberSchema = z.coerce
  .number({ message: 'cashier.table_bill.error.table_number' })
  .int('cashier.table_bill.error.table_number')
  .positive('cashier.table_bill.error.table_number');

export const billTenderSchema = z.object({
  amount: z.coerce.number({ message: 'cashier.table_bill.error.amount' }).positive('cashier.table_bill.error.amount'),
  paymentMethod: z.nativeEnum(PaymentMethod),
});

export type BillTenderInput = z.infer<typeof billTenderSchema>;
