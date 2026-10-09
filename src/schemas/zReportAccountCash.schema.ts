import { z } from 'zod';

const nonnegativeMinor = z.number().int().nonnegative().safe();
const currencyRow = z
  .object({
    currency: z.string().regex(/^[A-Z]{3}$/),
    collectionCount: nonnegativeMinor,
    collectedExactMinor: nonnegativeMinor,
    cashReceivedMinor: nonnegativeMinor,
    changeReturnedMinor: nonnegativeMinor,
    cashDueMinor: nonnegativeMinor,
    returnCount: nonnegativeMinor,
    exactRefundedMinor: nonnegativeMinor,
    physicalCashReturnedMinor: nonnegativeMinor,
    refundAdjustmentMinor: z.number().int().safe(),
    legacyCaptureWithoutReceiptCount: nonnegativeMinor,
    legacyCaptureExactMinor: nonnegativeMinor,
    legacyReturnWithoutPhysicalEvidenceCount: nonnegativeMinor,
    legacyExactRefundMinor: nonnegativeMinor,
    unresolvedReturnCount: nonnegativeMinor,
    unresolvedExactRefundMinor: nonnegativeMinor,
    unconfirmedPhysicalCashMinor: nonnegativeMinor,
  })
  .refine(
    (row) =>
      [
        row.cashReceivedMinor,
        row.changeReturnedMinor,
        row.cashDueMinor,
        row.exactRefundedMinor,
        row.refundAdjustmentMinor,
        row.physicalCashReturnedMinor,
      ].every(Number.isSafeInteger) &&
      BigInt(row.cashReceivedMinor) - BigInt(row.changeReturnedMinor) === BigInt(row.cashDueMinor) &&
      BigInt(row.exactRefundedMinor) + BigInt(row.refundAdjustmentMinor) === BigInt(row.physicalCashReturnedMinor),
  );

export const zReportAccountCashSchema = z
  .object({
    snapshotAtUtc: z.string().datetime({ offset: true }),
    coverage: z.string().min(1),
    coversWholeRestaurantTill: z.literal(false),
    byCurrency: z.array(currencyRow),
    unresolvedByCurrency: z.array(currencyRow),
  })
  .refine((report) =>
    [report.byCurrency, report.unresolvedByCurrency].every(
      (rows) => new Set(rows.map((row) => row.currency)).size === rows.length,
    ),
  )
  .refine(
    (report) =>
      report.byCurrency.every(
        (row) =>
          row.unresolvedReturnCount === 0 &&
          row.unresolvedExactRefundMinor === 0 &&
          row.unconfirmedPhysicalCashMinor === 0,
      ) &&
      report.unresolvedByCurrency.every((row) =>
        [
          row.collectionCount,
          row.collectedExactMinor,
          row.cashReceivedMinor,
          row.changeReturnedMinor,
          row.cashDueMinor,
          row.returnCount,
          row.exactRefundedMinor,
          row.physicalCashReturnedMinor,
          row.refundAdjustmentMinor,
          row.legacyCaptureWithoutReceiptCount,
          row.legacyCaptureExactMinor,
          row.legacyReturnWithoutPhysicalEvidenceCount,
          row.legacyExactRefundMinor,
        ].every((value) => value === 0),
      ),
  );
