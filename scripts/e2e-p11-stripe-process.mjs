import { spawn } from 'node:child_process';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_COMMAND_TIMEOUT_MS = 5 * 60 * 1000;
const STOP_GRACE_MS = 5000;
const MAX_CAPTURE_BYTES = 1024 * 1024;

export function readGeneratedEnvironment(filename) {
  assertPrivateLogParent(filename);
  let descriptor;
  let contents;
  try {
    const linkStat = lstatSync(filename);
    if (!linkStat.isFile() || linkStat.isSymbolicLink()) throw new Error('not a regular private file');
    descriptor = openSync(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.dev !== linkStat.dev ||
      stat.ino !== linkStat.ino
    )
      throw new Error('not a regular private file');
    contents = readFileSync(descriptor, 'utf8');
  } catch {
    throw new Error('Generated run environment could not be read privately.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  return parseGeneratedEnvironment(contents);
}

export function parseGeneratedEnvironment(contents) {
  return Object.fromEntries(
    contents
      .trim()
      .split('\n')
      .map((line) => {
        const split = line.indexOf('=');
        const key = line.slice(0, split);
        if (split < 1 || !/^[A-Za-z_][A-Za-z_0-9]*$/.test(key)) throw new Error('Invalid generated run environment.');
        let value;
        try {
          value = JSON.parse(line.slice(split + 1));
        } catch {
          throw new Error('Invalid generated environment value.');
        }
        if (typeof value !== 'string' || /[\r\n\0]/.test(value))
          throw new Error('Invalid generated environment value.');
        return [key, value];
      }),
  );
}

function assertPrivateLogParent(logfile) {
  if (constants.O_NOFOLLOW === undefined || constants.O_DIRECTORY === undefined || !process.getuid)
    throw new Error('Private acceptance logging is unavailable on this platform.');
  let descriptor;
  try {
    const directory = path.dirname(logfile);
    const linkStat = lstatSync(directory);
    descriptor = openSync(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    const stat = fstatSync(descriptor);
    if (
      !linkStat.isDirectory() ||
      linkStat.isSymbolicLink() ||
      !stat.isDirectory() ||
      stat.uid !== process.getuid() ||
      (stat.mode & 0o777) !== 0o700 ||
      stat.dev !== linkStat.dev ||
      stat.ino !== linkStat.ino
    )
      throw new Error('Acceptance logs require a same-user mode-0700 parent directory.');
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Acceptance logs')) throw error;
    throw new Error('Acceptance logs require a same-user mode-0700 parent directory.');
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function openPrivateLog(logfile) {
  assertPrivateLogParent(logfile);
  let descriptor;
  try {
    descriptor = openSync(
      logfile,
      constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW,
      0o600,
    );
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600)
      throw new Error('Acceptance logs must be same-user mode-0600 regular files.');
    assertPrivateLogParent(logfile);
    return descriptor;
  } catch (error) {
    if (descriptor !== undefined) closeSync(descriptor);
    if (error instanceof Error && error.message.startsWith('Acceptance logs')) throw error;
    throw new Error('Acceptance logs could not be opened safely.');
  }
}

function observeChild(child) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (code) => {
      if (settled) return;
      settled = true;
      resolve(code);
    };
    child.once('error', () => finish(-1));
    child.once('close', (code) => finish(code ?? -1));
  });
}

function signalChild(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall through to the direct child when it was not started as a process group.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The close observer below determines whether the process stopped.
  }
}

export function startLogged(command, args, env, cwd, logfile, { signal } = {}) {
  if (signal?.aborted) throw new Error('Acceptance was interrupted before subprocess startup.');
  const descriptor = openPrivateLog(logfile);
  let child;
  try {
    child = spawn(command, args, {
      env,
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', descriptor, descriptor],
    });
  } finally {
    closeSync(descriptor);
  }
  const completed = observeChild(child);
  const abort = () => signalChild(child, 'SIGTERM');
  signal?.addEventListener('abort', abort, { once: true });
  completed.finally(() => signal?.removeEventListener('abort', abort));
  if (signal?.aborted) abort();
  return { child, completed };
}

export async function waitForChildClose(child, timeoutMs = DEFAULT_COMMAND_TIMEOUT_MS, signal) {
  const completed = observeChild(child);
  let timer;
  let abort;
  const outcome = await Promise.race([
    completed.then((code) => ({ code })),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve({ reason: 'timeout' }), timeoutMs);
      if (signal) {
        abort = () => resolve({ reason: 'interrupted' });
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
      }
    }),
  ]);
  clearTimeout(timer);
  if (signal && abort) signal.removeEventListener('abort', abort);
  if (outcome.reason) {
    signalChild(child, 'SIGTERM');
    const stopped = await resolvesWithin(completed, STOP_GRACE_MS);
    if (!stopped) {
      signalChild(child, 'SIGKILL');
      await resolvesWithin(completed, STOP_GRACE_MS);
    }
    throw new Error(
      outcome.reason === 'timeout'
        ? 'An acceptance subprocess exceeded its deadline; private run evidence is retained.'
        : 'An acceptance subprocess was interrupted; private run evidence is retained.',
    );
  }
  return outcome.code;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function resolvesWithin(promise, timeoutMs) {
  let timer;
  const result = await Promise.race([
    promise.then(() => true),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return result;
}

export async function runLogged(command, args, env, cwd, logfile, options = {}) {
  const processState = startLogged(command, args, env, cwd, logfile, options);
  const code = await waitForChildClose(
    processState.child,
    options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    options.signal,
  );
  if (code !== 0) throw new Error('An acceptance subprocess failed; private run evidence is retained.');
}

/** Capture small orchestration replies; subprocess diagnostics remain in the private log. */
export async function captureLogged(command, args, env, cwd, logfile, options = {}) {
  if (options.signal?.aborted) throw new Error('An acceptance subprocess was interrupted before startup.');
  const descriptor = openPrivateLog(logfile);
  let child;
  try {
    child = spawn(command, args, {
      env,
      cwd,
      shell: false,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', descriptor],
    });
  } finally {
    closeSync(descriptor);
  }
  let output = '';
  let outputBytes = 0;
  let oversized = false;
  child.stdout.on('data', (chunk) => {
    outputBytes += chunk.length;
    if (outputBytes > (options.maxStdoutBytes ?? MAX_CAPTURE_BYTES)) {
      oversized = true;
      signalChild(child, 'SIGKILL');
      return;
    }
    output += chunk;
  });
  const code = await waitForChildClose(child, options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS, options.signal);
  if (code !== 0 || oversized) throw new Error('An acceptance subprocess reply failed; private evidence is retained.');
  return output;
}

function hasStopped(processState) {
  return (
    !processState ||
    processState.child.exitCode !== null ||
    processState.child.signalCode !== null ||
    processState.child.pid === undefined
  );
}

export async function stopProcess(processState) {
  if (hasStopped(processState)) return;
  signalChild(processState.child, 'SIGTERM');
  const completed = await resolvesWithin(processState.completed, STOP_GRACE_MS);
  if (!completed) {
    signalChild(processState.child, 'SIGKILL');
    const killed = await resolvesWithin(processState.completed, STOP_GRACE_MS);
    if (!killed) throw new Error('An owned acceptance process did not stop after termination.');
  }
}

/** Always attempts the evidence snapshot after stopping every owned process. */
export async function stopOwnedProcessesAndSnapshot(processes, snapshot) {
  let stopFailed = false;
  for (const processState of processes) {
    try {
      await stopProcess(processState);
    } catch {
      stopFailed = true;
    }
  }
  let snapshotResult;
  let snapshotFailed = false;
  try {
    snapshotResult = await snapshot();
  } catch {
    snapshotFailed = true;
  }
  return { stopFailed, snapshotFailed, snapshotResult };
}

export function installCancellationHandlers(controller) {
  const handlers = new Map([
    ['SIGINT', () => abortForSignal(controller, 'SIGINT')],
    ['SIGTERM', () => abortForSignal(controller, 'SIGTERM')],
  ]);
  for (const [name, handler] of handlers) process.on(name, handler);
  return () => {
    for (const [name, handler] of handlers) process.off(name, handler);
  };
}

function abortForSignal(controller, signal) {
  if (!controller.signal.aborted) {
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
    controller.abort(signal);
  }
}

export async function waitUntil(probe, timeoutMs, processState, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('The acceptance run was interrupted.');
    if (processState && hasStopped(processState)) throw new Error('An acceptance service stopped before readiness.');
    const remaining = deadline - Date.now();
    const probeController = new AbortController();
    let abortProbe;
    const interrupted = signal
      ? new Promise((resolve) => {
          abortProbe = () => {
            probeController.abort();
            resolve({ reason: 'interrupted' });
          };
          signal.addEventListener('abort', abortProbe, { once: true });
          if (signal.aborted) abortProbe();
        })
      : new Promise(() => {});
    let timer;
    let result;
    try {
      result = await Promise.race([
        Promise.resolve()
          .then(() => probe(probeController.signal, remaining))
          .then((value) => ({ value })),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ reason: 'timeout' }), remaining);
        }),
        interrupted,
      ]);
    } catch (error) {
      probeController.abort();
      clearTimeout(timer);
      if (signal && abortProbe) signal.removeEventListener('abort', abortProbe);
      throw error;
    }
    clearTimeout(timer);
    if (signal && abortProbe) signal.removeEventListener('abort', abortProbe);
    if (result.reason) {
      probeController.abort();
      throw new Error(
        result.reason === 'timeout'
          ? 'The acceptance service did not become ready.'
          : 'The acceptance run was interrupted.',
      );
    }
    if (result.value) return;
    if (signal?.aborted) throw new Error('The acceptance run was interrupted.');
    await delay(Math.min(500, Math.max(1, deadline - Date.now())));
  }
  throw new Error('The acceptance service did not become ready.');
}
