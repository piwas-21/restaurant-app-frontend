import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const valid = {
  TENANT_DOMAIN: 'venue.example',
  PUBLIC_DEFAULT_LOCALE: 'fr',
  PUBLIC_HOME_LOCALES: 'fr,en',
  PUBLIC_MENU_LOCALES: 'fr',
  PUBLIC_INDEXING: 'true',
};
function validate(overrides = {}) {
  return spawnSync(process.execPath, [new URL('./validate-public-discovery.mjs', import.meta.url).pathname], {
    env: { ...process.env, ...valid, ...overrides },
    encoding: 'utf8',
  });
}

test('audited configuration can start the image build', () => {
  assert.equal(validate().status, 0);
});

for (const overrides of [
  { PUBLIC_DEFAULT_LOCALE: 'fr-FR' },
  { PUBLIC_HOME_LOCALES: 'fr,fr' },
  { PUBLIC_MENU_LOCALES: 'en' },
  { PUBLIC_INDEXING: 'yes' },
  { PUBLIC_HOME_LOCALES: 'fr,en\n' },
  { TENANT_DOMAIN: 'venue.example\n' },
  { TENANT_DOMAIN: 'https://venue.example' },
]) {
  test(`malformed configuration stops the image build: ${JSON.stringify(overrides)}`, () => {
    const result = validate(overrides);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.trim());
  });
}
