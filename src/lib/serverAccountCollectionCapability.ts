export interface ServerAccountCollectionCapabilityInput {
  readonly role: string | undefined;
  readonly tableAccountPaymentsV1: boolean;
  readonly serverAccountCollectionV1: boolean;
  readonly serverModuleEnabled: boolean;
  readonly cashierModuleEnabled: boolean;
  readonly sessionCanCollect: boolean;
  readonly sessionOpen: boolean;
}

/** Mirrors the staff-role/module boundary enforced by AccountPaymentActorResolver. */
export function canStartServerAccountCollection(input: ServerAccountCollectionCapabilityInput): boolean {
  if (!input.tableAccountPaymentsV1 || !input.sessionCanCollect || !input.sessionOpen) return false;
  const role = input.role?.toLowerCase();
  if (role === 'server') return input.serverAccountCollectionV1 && input.serverModuleEnabled;
  if (role === 'admin') return input.serverModuleEnabled || input.cashierModuleEnabled;
  return false;
}
