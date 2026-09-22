import { test as base } from '@playwright/test';
import { type StaffUser, usePromotedStaffUser } from './cashierUser';

/** Server-role auth fixture backed by the shared ephemeral staff-user lifecycle. */
export type ServerUser = StaffUser;

export const test = base.extend<{ serverUser: ServerUser }>({
  serverUser: async ({ baseURL }, use, testInfo) =>
    usePromotedStaffUser(baseURL, use, testInfo, {
      role: 'Server',
      storageRole: 'server',
      fixtureName: 'serverUser',
    }),
});

export { expect } from '@playwright/test';
