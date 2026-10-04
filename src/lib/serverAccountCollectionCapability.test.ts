import { canStartServerAccountCollection } from './serverAccountCollectionCapability';

const enabled = {
  tableAccountPaymentsV1: true,
  serverAccountCollectionV1: true,
  serverModuleEnabled: true,
  cashierModuleEnabled: false,
  sessionCanCollect: true,
  sessionOpen: true,
};

it('requires explicit Server opt-in and Server module for Server collection', () => {
  expect(canStartServerAccountCollection({ ...enabled, role: 'Server' })).toBe(true);
  expect(
    canStartServerAccountCollection({
      ...enabled,
      role: 'Server',
      cashierModuleEnabled: true,
      serverModuleEnabled: false,
    }),
  ).toBe(false);
  expect(canStartServerAccountCollection({ ...enabled, role: 'Server', serverAccountCollectionV1: false })).toBe(false);
  expect(canStartServerAccountCollection({ ...enabled, role: 'Server', tableAccountPaymentsV1: false })).toBe(false);
});

it('preserves Admin authority through either enabled staff module without requiring the Server opt-in', () => {
  expect(canStartServerAccountCollection({ ...enabled, role: 'Admin', serverAccountCollectionV1: false })).toBe(true);
  expect(
    canStartServerAccountCollection({
      ...enabled,
      role: 'Admin',
      serverAccountCollectionV1: false,
      serverModuleEnabled: false,
      cashierModuleEnabled: true,
    }),
  ).toBe(true);
});

it.each([
  ['a non-staff role', { role: 'Guest' }],
  ['a missing role', { role: undefined }],
  ['a closed visit', { role: 'Server', sessionOpen: false }],
  ['a backend collection denial', { role: 'Server', sessionCanCollect: false }],
  ['an Admin with neither collection module', { role: 'Admin', serverModuleEnabled: false }],
])('fails closed for %s', (_label, override) => {
  expect(canStartServerAccountCollection({ ...enabled, ...override })).toBe(false);
});

it('does not widen the Server route to Cashier role access', () => {
  expect(canStartServerAccountCollection({ ...enabled, role: 'Cashier', cashierModuleEnabled: true })).toBe(false);
});
