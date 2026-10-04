import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePsqlExecutable } from './e2e-seed.mjs';

const supportedExecutables = ['/usr/bin/psql', '/opt/homebrew/bin/psql', '/usr/local/bin/psql'];

test('uses the first executable in the fixed supported location order', () => {
  const checked = [];
  const executable = resolvePsqlExecutable((candidate) => {
    checked.push(candidate);
    return candidate === '/opt/homebrew/bin/psql';
  });

  assert.equal(executable, '/opt/homebrew/bin/psql');
  assert.deepEqual(checked, supportedExecutables.slice(0, 2));
});

test('fails closed without searching PATH or accepting an arbitrary executable', () => {
  const checked = [];
  const previousPath = process.env.PATH;
  process.env.PATH = '/tmp/e2e-untrusted-bin';

  try {
    assert.throws(
      () =>
        resolvePsqlExecutable((candidate) => {
          checked.push(candidate);
          return false;
        }),
      /supported fixed installation location/,
    );
    assert.deepEqual(checked, supportedExecutables);
    assert.equal(
      checked.every((candidate) => candidate.startsWith('/')),
      true,
    );
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
  }
});
