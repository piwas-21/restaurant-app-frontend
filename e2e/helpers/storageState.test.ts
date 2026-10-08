import { chmod, lstat, mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveP11AuthDirectory, writeAuthStorageState } from './storageState';

const STRIPE_RUN_ID = '0123456789abcdef'; // pragma: allowlist secret -- Synthetic run identifier

describe('P11 authentication storage', () => {
  let artifactDirectory: string;

  beforeEach(async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), 'p11-auth-state-'));
    await chmod(artifactDirectory, 0o700);
  });

  afterEach(async () => {
    await rm(artifactDirectory, { recursive: true, force: true });
  });

  it('routes cash and Stripe fixtures only to their validated run artifact directories', () => {
    expect(resolveP11AuthDirectory({ P11_ARTIFACT_DIR: '/tmp/table-account-p11.a1b2c3d4/playwright' })).toBe(
      '/tmp/table-account-p11.a1b2c3d4/playwright/auth',
    );
    expect(
      resolveP11AuthDirectory({
        P11_RUN_ID: STRIPE_RUN_ID,
        P11_STRIPE_ARTIFACT_DIR: `/tmp/table-account-p11-stripe-evidence/${STRIPE_RUN_ID}/browser`,
      }),
    ).toBe(`/tmp/table-account-p11-stripe-evidence/${STRIPE_RUN_ID}/browser/auth`);
  });

  it('rejects ambiguous or unrecognized P11 artifact locations', () => {
    expect(() => resolveP11AuthDirectory({ P11_ARTIFACT_DIR: '/tmp/unrelated/playwright' })).toThrow(
      'validated private run artifact directory',
    );
    expect(() =>
      resolveP11AuthDirectory({
        P11_ARTIFACT_DIR: '/tmp/table-account-p11.a1b2c3d4/playwright',
        P11_STRIPE_ARTIFACT_DIR: `/tmp/table-account-p11-stripe-evidence/${STRIPE_RUN_ID}/browser`,
        P11_RUN_ID: STRIPE_RUN_ID,
      }),
    ).toThrow('validated private run artifact directory');
  });

  it('writes exclusive mode-0600 files beneath a same-owner mode-0700 directory', async () => {
    const authDirectory = path.join(artifactDirectory, 'auth');
    const options = {
      frontendOrigin: 'http://127.0.0.1:56663',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: {
        userId: 'p11-user',
        firstName: 'P11',
        lastName: 'Admin',
        email: 'p11@test.local',
        role: 'Admin',
        accessToken: 'test-access-token',
      },
      role: 'p11-admin',
      slug: '0-00000000-0000-4000-8000-000000000001',
      authDirectory,
    };

    const filename = await writeAuthStorageState(options);
    const fileStat = await lstat(filename);
    const directoryStat = await lstat(authDirectory);
    const userId = process.getuid?.();
    expect(userId).toBeDefined();
    expect(directoryStat.mode & 0o777).toBe(0o700);
    expect(directoryStat.uid).toBe(userId);
    expect(fileStat.isFile()).toBe(true);
    expect(fileStat.mode & 0o777).toBe(0o600);
    expect(fileStat.uid).toBe(userId);
    expect(JSON.parse(await readFile(filename, 'utf8')).origins[0].localStorage).toHaveLength(3);
    await expect(writeAuthStorageState(options)).rejects.toThrow();
  });

  it('rejects a linked or broadly readable auth directory', async () => {
    const linkedDirectory = path.join(artifactDirectory, 'linked-auth');
    const targetDirectory = path.join(artifactDirectory, 'target');
    await mkdir(targetDirectory, { mode: 0o700 });
    await symlink(targetDirectory, linkedDirectory);
    await expect(
      writeAuthStorageState({
        frontendOrigin: 'http://127.0.0.1:56663',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: {
          firstName: 'P11',
          lastName: 'Admin',
          email: 'p11@test.local',
          role: 'Admin',
          accessToken: 'test-access-token',
        },
        role: 'p11-admin',
        slug: '0-00000000-0000-4000-8000-000000000002',
        authDirectory: linkedDirectory,
      }),
    ).rejects.toThrow('owner-only directories');

    const publicDirectory = path.join(artifactDirectory, 'public-auth');
    await mkdir(publicDirectory, { mode: 0o700 });
    await chmod(publicDirectory, 0o755);
    await expect(
      writeAuthStorageState({
        frontendOrigin: 'http://127.0.0.1:56663',
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: {
          firstName: 'P11',
          lastName: 'Admin',
          email: 'p11@test.local',
          role: 'Admin',
          accessToken: 'test-access-token',
        },
        role: 'p11-admin',
        slug: '0-00000000-0000-4000-8000-000000000003',
        authDirectory: publicDirectory,
      }),
    ).rejects.toThrow('owner-only directories');
  });
});
