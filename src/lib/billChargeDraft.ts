import type { BillChargeInput } from '@/types/billCharge';
export function readBillChargeInputs(value: unknown): BillChargeInput[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 12) throw new Error('Invalid bill charge draft');
  return value.map((row: unknown) => {
    if (typeof row !== 'object' || row === null) throw new Error('Invalid bill charge');
    const input = row as Record<string, unknown>;
    if (
      typeof input.key !== 'string' ||
      !/^[a-z][a-z0-9_]{0,39}$/.test(input.key) ||
      typeof input.amount !== 'number' ||
      !Number.isFinite(input.amount) ||
      input.amount < 0 ||
      input.amount > 10000
    )
      throw new Error('Invalid bill charge');
    return { key: input.key, amount: input.amount };
  });
}
