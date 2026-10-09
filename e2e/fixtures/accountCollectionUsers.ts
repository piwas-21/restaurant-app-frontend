import { test as base } from '@playwright/test';
import { type StaffUser, usePromotedStaffUser } from './cashierUser';

/** Durable staff identities for connected account flows whose audit FKs must retain their actor. */
export const test = base.extend<{
  accountCashierUser: StaffUser;
  accountServerUser: StaffUser;
}>({
  accountCashierUser: async ({ baseURL }, use, testInfo) =>
    usePromotedStaffUser(baseURL, use, testInfo, {
      role: 'Cashier',
      storageRole: 'cashier',
      fixtureName: 'accountCashierUser',
      preserveUser: true,
    }),
  accountServerUser: async ({ baseURL }, use, testInfo) =>
    usePromotedStaffUser(baseURL, use, testInfo, {
      role: 'Server',
      storageRole: 'server',
      fixtureName: 'accountServerUser',
      preserveUser: true,
    }),
});

export { expect } from '@playwright/test';
export type { StaffUser };
