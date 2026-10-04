import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { createPsqlEnvironment } = require('./e2e-database-target.cjs');
const seedPath = fileURLToPath(new URL('../e2e/seed/seed.sql', import.meta.url));
const PSQL_EXECUTABLE_CANDIDATES = Object.freeze(['/usr/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/bin/psql']);

function hasExecutableAccess(path) {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolvePsqlExecutable(canExecute = hasExecutableAccess) {
  const executable = PSQL_EXECUTABLE_CANDIDATES.find(canExecute);
  if (!executable) {
    throw new Error('Could not find psql in a supported fixed installation location.');
  }
  return executable;
}

export function runE2ESeed() {
  let result;

  try {
    const env = createPsqlEnvironment();
    const executable = resolvePsqlExecutable();
    result = spawnSync(executable, ['-v', 'ON_ERROR_STOP=1', '-f', seedPath], {
      env,
      shell: false,
      stdio: 'inherit',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'E2E SQL seed refused.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }

  if (result.error) {
    process.stderr.write('Could not start psql; confirm the PostgreSQL client is installed.\n');
    process.exitCode = 1;
  } else if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runE2ESeed();
}
