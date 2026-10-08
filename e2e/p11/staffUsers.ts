import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { request, test as base, type APIRequestContext, type TestInfo } from '@playwright/test';
import { promoteE2EUser } from '../helpers/db';
import { apiBaseUrl } from '../helpers/config';
import { resolveP11AuthDirectory, writeAuthStorageState } from '../helpers/storageState';

export interface P11StaffUser {
  readonly email: string;
  readonly role: 'Admin' | 'Cashier' | 'Server';
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly storageStatePath: string;
}

interface ApiResponse<T> {
  readonly success: boolean;
  readonly message?: string;
  readonly data?: T;
}

interface LoginResult {
  readonly userId: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly role: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

type Role = P11StaffUser['role'];

type P11StaffFixtures = {
  readonly p11Admin: P11StaffUser;
  readonly p11Cashier: P11StaffUser;
  readonly p11Server: P11StaffUser;
};

const require = createRequire(path.resolve('e2e/p11/staffUsers.ts'));
const { createRunOwnedStaffCredential } = require('../../scripts/e2e-p11-target.cjs') as {
  createRunOwnedStaffCredential: () => string;
};

export const test = base.extend<P11StaffFixtures>({
  p11Admin: async ({ baseURL }, use, testInfo) => useRunOwnedStaffUser(baseURL, use, testInfo, 'Admin'),
  p11Cashier: async ({ baseURL }, use, testInfo) => useRunOwnedStaffUser(baseURL, use, testInfo, 'Cashier'),
  p11Server: async ({ baseURL }, use, testInfo) => useRunOwnedStaffUser(baseURL, use, testInfo, 'Server'),
});

async function useRunOwnedStaffUser(
  baseURL: string | undefined,
  use: (user: P11StaffUser) => Promise<void>,
  testInfo: TestInfo,
  role: Role,
): Promise<void> {
  const email = `e2e-p11-${role.toLowerCase()}-${randomUUID()}@test.local`;
  const generatedCredential = createRunOwnedStaffCredential();
  const firstName = 'P11';
  const lastName = role;
  const api = await request.newContext({ baseURL: apiBaseUrl() });
  let storageStatePath: string | null = null;

  try {
    await registerCustomer(api, email, generatedCredential, firstName, lastName);
    const updated = await promoteE2EUser(email, role);
    if (updated !== 1) throw new Error(`P11 ${role} promotion updated ${updated} users; expected one.`);
    const login = await loginUser(api, email, generatedCredential);
    if (login.role !== role) throw new Error(`P11 ${role} login returned a different staff role.`);

    storageStatePath = await writeAuthStorageState({
      frontendOrigin: baseURL ?? process.env.E2E_BASE_URL ?? '',
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
      user: {
        userId: login.userId,
        firstName: login.firstName,
        lastName: login.lastName,
        email: login.email,
        role: login.role,
        accessToken: login.accessToken,
      },
      role: `p11-${role.toLowerCase()}`,
      slug: `${testInfo.workerIndex}-${randomUUID()}`,
      authDirectory: resolveP11AuthDirectory(process.env),
    });

    await use({
      email,
      role,
      accessToken: login.accessToken,
      refreshToken: login.refreshToken,
      storageStatePath,
    });
  } finally {
    await api.dispose();
    if (storageStatePath) await rm(storageStatePath, { force: true });
    // Keep the run-owned user rows in the disposable database: order and payment actor references
    // remain inspectable in the database snapshot written before the runner removes its volume.
  }
}

async function registerCustomer(
  api: APIRequestContext,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<void> {
  const response = await api.post('/api/User/register/customer', {
    data: { firstName, lastName, email, password, confirmPassword: password },
  });
  const result = (await response.json()) as ApiResponse<unknown>;
  if (!response.ok() || result.success !== true) {
    throw new Error(`P11 staff registration failed with HTTP ${response.status()}.`);
  }
}

async function loginUser(api: APIRequestContext, email: string, password: string): Promise<LoginResult> {
  const response = await api.post('/api/Auth/login', { data: { email, password } });
  const result = (await response.json()) as ApiResponse<LoginResult>;
  if (!response.ok() || result.success !== true || !result.data) {
    throw new Error(`P11 staff login failed with HTTP ${response.status()}.`);
  }
  return result.data;
}
