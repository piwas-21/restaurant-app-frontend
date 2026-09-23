/** Least-privilege customer projection used by staff order composers. */
export interface StaffCustomerLookup {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly currentPoints: number;
}

/** Controlled customer selection. currentPoints is display-only and never trusted for redemption. */
export interface StaffCustomerSelection {
  readonly customerUserId?: string;
  readonly customerName?: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
  readonly currentPoints?: number;
  readonly pointsToRedeem?: number;
}

export function customerSelectionFromLookup(customer: StaffCustomerLookup): StaffCustomerSelection {
  return {
    customerUserId: customer.id,
    customerName: customer.fullName,
    customerEmail: customer.email || undefined,
    customerPhone: customer.phoneNumber || undefined,
    currentPoints: Math.max(0, customer.currentPoints),
    pointsToRedeem: 0,
  };
}

export function customerSelectionIsEmpty(selection?: StaffCustomerSelection): boolean {
  return !selection || Object.values(selection).every((value) => value === undefined || value === '');
}

/** Defensive read for versioned order drafts. Only a selected account may carry points. */
export function readStaffCustomerSelection(value: unknown): StaffCustomerSelection | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const row = value as Record<string, unknown>;
  const optionalText = (field: unknown) => (typeof field === 'string' && field.trim() ? field.trim() : undefined);
  const customerUserId = optionalText(row.customerUserId);
  const customerName = optionalText(row.customerName);
  const customerEmail = optionalText(row.customerEmail);
  const customerPhone = optionalText(row.customerPhone);
  const currentPoints =
    customerUserId && typeof row.currentPoints === 'number' && Number.isFinite(row.currentPoints)
      ? Math.max(0, Math.floor(row.currentPoints))
      : undefined;
  const pointsToRedeem =
    currentPoints !== undefined && typeof row.pointsToRedeem === 'number' && Number.isFinite(row.pointsToRedeem)
      ? Math.max(0, Math.min(currentPoints, Math.floor(row.pointsToRedeem)))
      : undefined;
  const selection: StaffCustomerSelection = {
    ...(customerUserId ? { customerUserId } : {}),
    ...(customerName ? { customerName } : {}),
    ...(customerEmail ? { customerEmail } : {}),
    ...(customerPhone ? { customerPhone } : {}),
    ...(currentPoints !== undefined ? { currentPoints } : {}),
    ...(pointsToRedeem !== undefined ? { pointsToRedeem } : {}),
  };
  return customerSelectionIsEmpty(selection) ? undefined : selection;
}
