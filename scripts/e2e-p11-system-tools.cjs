/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const SYSTEM_CANDIDATES = Object.freeze({
  docker: [
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
    '/usr/bin/docker',
    '/Applications/Docker.app/Contents/Resources/bin/docker',
  ],
  git: ['/usr/bin/git', '/usr/local/bin/git', '/opt/homebrew/bin/git'],
  curl: ['/usr/bin/curl', '/opt/homebrew/bin/curl', '/usr/local/bin/curl'],
});

function isSafeParentChain(filename) {
  let directory = path.dirname(filename);
  while (directory !== path.dirname(directory)) {
    const stat = fs.statSync(directory);
    if (!stat.isDirectory() || (stat.mode & 0o022) !== 0) return false;
    directory = path.dirname(directory);
  }
  return true;
}

function validateExecutable(filename) {
  if (typeof filename !== 'string' || !path.isAbsolute(filename))
    throw new Error('The acceptance command path must be absolute.');
  let canonical;
  let stat;
  try {
    canonical = fs.realpathSync(filename);
    stat = fs.statSync(canonical);
  } catch {
    throw new Error('The required acceptance command is unavailable.');
  }
  if (!stat.isFile() || (stat.mode & 0o111) === 0 || (stat.mode & 0o022) !== 0 || !isSafeParentChain(canonical))
    throw new Error('The acceptance command must be an executable from protected directories.');
  return canonical;
}

function resolveSystemExecutable(name) {
  const candidates = SYSTEM_CANDIDATES[name];
  if (!candidates) throw new Error('The acceptance command is not in the approved system-tool list.');
  for (const candidate of candidates) {
    try {
      return validateExecutable(candidate);
    } catch {
      // Try the next fixed system location; never search PATH.
    }
  }
  throw new Error(`The approved ${name} executable is unavailable.`);
}

module.exports = { resolveSystemExecutable, validateExecutable };
