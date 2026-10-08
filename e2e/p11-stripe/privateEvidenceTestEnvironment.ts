import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(path.resolve('e2e/p11-stripe/privateEvidenceTestEnvironment.ts'));
const { ensurePrivateArtifactDirectories } = require('../../scripts/e2e-p11-stripe-profile.cjs') as {
  ensurePrivateArtifactDirectories: (runId: string, evidenceRoot: string) => { browserDir: string };
};

const RUN_ID = '0000000000000000';
const ENVIRONMENT_KEYS = ['P11_STRIPE_EVIDENCE_ROOT', 'P11_RUN_ID', 'P11_STRIPE_ARTIFACT_DIR'] as const;

export function createPrivateEvidenceTestEnvironment(prefix: string) {
  const previousEnvironment = Object.fromEntries(ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]));
  const evidenceRoot = mkdtempSync(path.join(os.tmpdir(), prefix));
  chmodSync(evidenceRoot, 0o700);

  try {
    const browserDirectory = ensurePrivateArtifactDirectories(RUN_ID, evidenceRoot).browserDir;
    process.env.P11_STRIPE_EVIDENCE_ROOT = evidenceRoot;
    process.env.P11_RUN_ID = RUN_ID;
    process.env.P11_STRIPE_ARTIFACT_DIR = browserDirectory;

    let disposed = false;
    return {
      browserDirectory,
      dispose() {
        if (disposed) return;
        disposed = true;
        for (const key of ENVIRONMENT_KEYS) {
          const value = previousEnvironment[key];
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
        rmSync(evidenceRoot, { recursive: true, force: true });
      },
    };
  } catch (error) {
    rmSync(evidenceRoot, { recursive: true, force: true });
    throw error;
  }
}
