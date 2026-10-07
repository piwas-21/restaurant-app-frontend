import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  captureLogged,
  installCancellationHandlers,
  readGeneratedEnvironment,
  runLogged,
  startLogged,
  stopProcess,
  stopOwnedProcessesAndSnapshot,
  waitUntil,
  waitForChildClose,
} from './e2e-p11-stripe-process.mjs';

function privateState(t) {
  const state = mkdtempSync('/tmp/table-account-stripe-process-control.');
  t.after(() => rmSync(state, { recursive: true, force: true }));
  return state;
}

test('generated environment parsing treats shell syntax as literal text and rejects malformed values', (t) => {
  const state = privateState(t);
  const filename = path.join(state, 'runner.env');
  writeFileSync(filename, 'VALUE="$(not-executed)"\nOTHER="literal\\ntext"\n', { mode: 0o600 });
  assert.throws(() => readGeneratedEnvironment(filename), /Invalid generated environment value/);
  writeFileSync(filename, 'VALUE="$(not-executed)"\n', { mode: 0o600 });
  assert.deepEqual(readGeneratedEnvironment(filename), { VALUE: '$(not-executed)' });
  for (const invalid of ['BAD KEY="x"\n', 'VALUE=unquoted\n', 'VALUE=12\n']) {
    writeFileSync(filename, invalid, { mode: 0o600 });
    assert.throws(() => readGeneratedEnvironment(filename));
  }
});

test('subprocess output stays in a private log and nonzero exit cannot be reported as success', async (t) => {
  const state = privateState(t);
  const logfile = path.join(state, 'process.log');
  await runLogged(
    process.execPath,
    ['-e', "process.stdout.write('ready'); process.stderr.write('warning');"],
    {},
    state,
    logfile,
  );
  assert.equal(readFileSync(logfile, 'utf8'), 'readywarning');
  assert.equal(statSync(logfile).mode & 0o777, 0o600);
  await assert.rejects(
    runLogged(
      process.execPath,
      ['-e', "process.stderr.write('private failure detail'); process.exit(4);"],
      {},
      state,
      logfile,
    ),
    /acceptance subprocess failed; private run evidence is retained/,
  );
});

test('a log symlink is rejected before a subprocess can run or modify its target', async (t) => {
  const state = privateState(t);
  const target = path.join(state, 'target.log');
  const link = path.join(state, 'linked.log');
  const marker = path.join(state, 'child-started');
  writeFileSync(target, 'preserved', { mode: 0o600 });
  symlinkSync(target, link);
  await assert.rejects(
    runLogged(
      process.execPath,
      ['-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'started')`],
      {},
      state,
      link,
    ),
    /Acceptance logs could not be opened safely/,
  );
  assert.equal(existsSync(marker), false);
  assert.equal(readFileSync(target, 'utf8'), 'preserved');
});

test('owned processes are stopped and readiness cannot pass for an exited process', async (t) => {
  const state = privateState(t);
  const processState = startLogged(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000);'],
    {},
    state,
    path.join(state, 'service.log'),
  );
  await stopProcess(processState);
  assert.ok(processState.child.exitCode !== null || processState.child.signalCode !== null);
  await assert.rejects(
    waitUntil(() => true, 100, processState),
    /stopped before readiness/,
  );
  await stopProcess(processState);
});

test('readiness requires an affirmative probe and times out rather than silently succeeding', async () => {
  let calls = 0;
  await waitUntil(() => ++calls === 2, 2000);
  assert.equal(calls, 2);
  await assert.rejects(
    waitUntil(() => false, 20),
    /did not become ready/,
  );
  await assert.rejects(
    waitUntil(() => new Promise(() => {}), 20),
    /did not become ready/,
  );
});

test('captured orchestration output is bounded, while diagnostics stay private and failures cannot pass', async (t) => {
  const state = privateState(t);
  const logfile = path.join(state, 'capture.log');
  assert.equal(
    await captureLogged(
      process.execPath,
      ['-e', "process.stdout.write('127.0.0.1:55001'); process.stderr.write('private diagnostics');"],
      {},
      state,
      logfile,
    ),
    '127.0.0.1:55001',
  );
  assert.equal(readFileSync(logfile, 'utf8'), 'private diagnostics');
  assert.equal(statSync(logfile).mode & 0o777, 0o600);
  for (const code of ['process.exit(3);', "process.stdout.write('x'.repeat(2 * 1024 * 1024));"])
    await assert.rejects(
      captureLogged(process.execPath, ['-e', code], {}, state, logfile),
      /acceptance subprocess reply failed/,
    );
});

test('subprocess deadlines terminate a hung child and preserve the caller cleanup path', async (t) => {
  const state = privateState(t);
  let cleanupRan = false;
  await assert.rejects(
    (async () => {
      try {
        await runLogged(
          process.execPath,
          ['-e', 'setInterval(() => {}, 1000);'],
          {},
          state,
          path.join(state, 'timeout.log'),
          { timeoutMs: 30 },
        );
      } finally {
        cleanupRan = true;
      }
    })(),
    /exceeded its deadline/,
  );
  assert.equal(cleanupRan, true);
});

test('SIGINT aborts active children and still reaches bounded finalization', async (t) => {
  const state = privateState(t);
  const previousExitCode = process.exitCode;
  const controller = new AbortController();
  const uninstall = installCancellationHandlers(controller);
  let retainedSnapshotAttempted = false;
  const pidFile = path.join(state, 'active-child.pid');
  const ownedProcess = startLogged(
    process.execPath,
    [
      '-e',
      `require('node:fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid));setInterval(()=>{},1000);`,
    ],
    {},
    state,
    path.join(state, 'signal.log'),
    { signal: controller.signal },
  );
  await waitUntil(() => existsSync(pidFile), 1000, ownedProcess);
  const activeRun = waitForChildClose(ownedProcess.child, 30_000, controller.signal);
  const sendSignal = setTimeout(() => process.emit('SIGINT'), 30);
  let cleanup;
  try {
    await assert.rejects(activeRun, /interrupted/);
  } finally {
    clearTimeout(sendSignal);
    try {
      cleanup = await stopOwnedProcessesAndSnapshot([ownedProcess], async () => {
        const childPid = Number(readFileSync(pidFile, 'utf8'));
        assert.throws(() => process.kill(childPid, 0), { code: 'ESRCH' });
        retainedSnapshotAttempted = true;
        return { retained: true };
      });
    } finally {
      uninstall();
      process.exitCode = previousExitCode;
    }
  }
  assert.equal(controller.signal.aborted, true);
  assert.equal(retainedSnapshotAttempted, true);
  assert.deepEqual(cleanup, { stopFailed: false, snapshotFailed: false, snapshotResult: { retained: true } });
});
