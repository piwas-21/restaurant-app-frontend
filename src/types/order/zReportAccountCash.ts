import { z } from 'zod';
import { zReportAccountCashSchema } from '@/schemas/zReportAccountCash.schema';

export type ZReportAccountCashMovements = z.infer<typeof zReportAccountCashSchema>;
export type ZReportAccountCashCurrency = ZReportAccountCashMovements['byCurrency'][number];
