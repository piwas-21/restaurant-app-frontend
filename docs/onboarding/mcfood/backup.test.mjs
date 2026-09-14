#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { main, parseArguments, USAGE, validateBaseUrl } from './backup.mjs';

await test('accepts an explicit origin and strips its root slash', () => {
  assert.equal(validateBaseUrl('https://capture.example/'), 'https://capture.example');
  assert.deepEqual(parseArguments(['--base-url', 'https://capture.example/', '--out', 'private'], {}), {
    baseUrl: 'https://capture.example',
    out: 'private',
  });
});

await test('uses MCFOOD_BASE_URL when the flag is omitted', () => {
  assert.deepEqual(parseArguments(['--out', 'private'], { MCFOOD_BASE_URL: 'https://env.example/' }), {
    baseUrl: 'https://env.example',
    out: 'private',
  });
  assert.equal(
    parseArguments(['--base-url', 'https://flag.example'], { MCFOOD_BASE_URL: 'https://env.example' }).baseUrl,
    'https://flag.example',
  );
});

await test('rejects non-origin base URLs', () => {
  for (const candidate of [
    'http://capture.example',
    'https://user' + ':secret@capture.example',
    'https://capture.example/api',
    'https://capture.example?tenant=mcfood',
    'https://capture.example#catalogue',
    'https://capture.example//',
    'not-a-url',
  ]) {
    assert.throws(() => validateBaseUrl(candidate), /https origin/);
  }
});

await test('missing or malformed configuration prints usage and performs no network call', async () => {
  const errors = [];
  const originalError = console.error;
  const originalFetch = globalThis.fetch;
  console.error = (message) => errors.push(message);
  globalThis.fetch = () => {
    throw new Error('network must not be reached');
  };
  try {
    const env = { ...process.env };
    delete env.MCFOOD_BASE_URL;
    for (const args of [[], ['--base-url', 'http://capture.example']]) {
      assert.equal(await main({ argv: args, env }), false);
    }
  } finally {
    console.error = originalError;
    globalThis.fetch = originalFetch;
  }
  assert.equal(errors.length, 2);
  assert.ok(errors.every((message) => message.includes(USAGE.split('\n')[0])));
});
