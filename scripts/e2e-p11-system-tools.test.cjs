/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateExecutable } = require('./e2e-p11-system-tools.cjs');

test('accepts an explicit executable in a private directory and rejects unsafe resolution', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p11-system-tool-control-'));
  fs.chmodSync(directory, 0o700);
  const executable = path.join(directory, 'tool');
  fs.writeFileSync(executable, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  assert.equal(validateExecutable(executable), fs.realpathSync(executable));
  assert.throws(() => validateExecutable('tool'), /absolute/);
  fs.chmodSync(directory, 0o777);
  assert.throws(() => validateExecutable(executable), /protected directories/);
});
