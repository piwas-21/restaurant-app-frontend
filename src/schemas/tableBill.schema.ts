import { z } from 'zod';
import { PaymentMethod } from '@/types/order';

/**
 * The table-bill form's tender inputs. Error values are i18n keys, per the
 * house convention (schemas never carry prose; the dialog maps keys through `t`).
 *
 * The BILL's balance remains server-authoritative: it can change under the form and
 * the server refuses an over-tender with a message the dialog renders verbatim. When
 * the newer Tables workspace supplies received cash, this schema also blocks an
 * incomplete handoff before it records the tender.
 */
export const tableNumberSchema = z.coerce
  .number({ message: 'cashier.table_bill.error.table_number' })
  .int('cashier.table_bill.error.table_number')
  .positive('cashier.table_bill.error.table_number');

export const billTenderSchema = z
  .object({
    amount: z.coerce.number({ message: 'cashier.table_bill.error.amount' }).positive('cashier.table_bill.error.amount'),
    paymentMethod: z.nativeEnum(PaymentMethod),
    // The legacy table-bill dialog does not collect received cash, so this remains optional there.
    // The Tables workspace supplies it to reject an incomplete cash handoff before recording a tender.
    cashReceived: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (value.paymentMethod === PaymentMethod.Cash && value.cashReceived !== undefined) {
      const received = Number(value.cashReceived);
      if (!Number.isFinite(received) || received < value.amount) {
        context.addIssue({ code: 'custom', path: ['cashReceived'], message: 'cash_received_too_low' });
      }
    }
  });

export type BillTenderInput = z.infer<typeof billTenderSchema>;
