import { TransactionType } from '@/types/fidelity';

export const FIDELITY_TRANSACTION_LABELS: Readonly<Record<TransactionType, string>> = {
  [TransactionType.Earned]: 'points_transaction_earned',
  [TransactionType.Redeemed]: 'points_transaction_redeemed',
  [TransactionType.AdminAdjustment]: 'points_transaction_admin',
  [TransactionType.Expired]: 'points_transaction_expired',
  [TransactionType.Refunded]: 'points_transaction_refunded',
  [TransactionType.EarnedClawback]: 'points_transaction_clawback',
  [TransactionType.RedemptionRestored]: 'points_transaction_restored',
};
