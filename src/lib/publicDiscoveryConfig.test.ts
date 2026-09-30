import { parseTenantPublicConfig } from './publicDiscoveryConfig';

describe('parseTenantPublicConfig', () => {
  it('fails closed on malformed canonical origins without echoing configured values', () => {
    const configuredOrigin = 'https://tenant-origin.invalid host';
    let message = '';
    try {
      parseTenantPublicConfig({ NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN: configuredOrigin });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('NEXT_PUBLIC_TENANT_CANONICAL_ORIGIN must be an absolute http(s) origin');
    expect(message).toContain('invalid URL syntax');
    expect(message).not.toContain(configuredOrigin);
  });
});
