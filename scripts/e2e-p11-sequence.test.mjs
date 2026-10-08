import test from 'node:test';
import assert from 'node:assert/strict';
import { runSequentially } from './e2e-p11-sequence.mjs';

test('sequential operations preserve order and wait for each completion', async () => {
  const events = [];
  await runSequentially(['first', 'second', 'third'], async (value, index) => {
    events.push(`start:${index}:${value}`);
    await new Promise((resolve) => setTimeout(resolve, 1));
    events.push(`finish:${index}:${value}`);
  });
  assert.deepEqual(events, [
    'start:0:first',
    'finish:0:first',
    'start:1:second',
    'finish:1:second',
    'start:2:third',
    'finish:2:third',
  ]);
});

test('sequential operations stop after the first rejection', async () => {
  const events = [];
  await assert.rejects(
    runSequentially([1, 2, 3], async (value) => {
      events.push(value);
      if (value === 2) throw new Error('controlled failure');
    }),
    /controlled failure/,
  );
  assert.deepEqual(events, [1, 2]);
});
