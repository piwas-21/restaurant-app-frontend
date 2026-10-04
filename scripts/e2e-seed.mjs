import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPsqlEnvironment } from './e2e-database-target.mjs';

const seedPath = fileURLToPath(new URL('../e2e/seed/seed.sql', import.meta.url));
let result;

try {
  const env = createPsqlEnvironment();
  result = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', seedPath], {
    env,
    stdio: 'inherit',
  });
} catch (error) {
  const message = error instanceof Error ? error.message : 'E2E SQL seed refused.';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

if (result?.error) {
  process.stderr.write('Could not start psql; confirm the PostgreSQL client is installed.\n');
  process.exitCode = 1;
} else if (result && result.status !== 0) {
  process.exitCode = result.status ?? 1;
}
