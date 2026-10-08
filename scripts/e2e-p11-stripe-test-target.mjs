import { randomBytes } from 'node:crypto';

/** Build the shared run-scoped local environment used by isolated verifier tests. */
export function localP11StripeTarget(runId) {
  const database = `p11_${runId}`;
  const password = randomBytes(32).toString('hex');
  const apiPort = '55103';
  const uiPort = '55104';
  const databasePort = '55101';
  const redisPort = '55102';
  const printerKey = randomBytes(32).toString('hex');
  const qrSecret = randomBytes(32).toString('hex');
  const tenantIdentity = `table-account-p11-${runId}`;
  const env = {
    P11_RUN_ID: runId,
    P11_COMPOSE_PROJECT: `tableaccountp11-${runId}`,
    P11_DATABASE_NAME: database,
    P11_DATABASE_USER: database,
    P11_REDIS_PORT: redisPort,
    P11_API_PORT: apiPort,
    P11_UI_PORT: uiPort,
    P11_PRINTER_API_KEY: printerKey,
    P11_QR_CODE_SECRET: qrSecret,
    E2E_DATABASE_TARGET: 'disposable',
    E2E_DATABASE_URL: `postgres://${database}:${password}@127.0.0.1:${databasePort}/${database}`,
    E2E_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    E2E_BASE_URL: `http://127.0.0.1:${uiPort}`,
    ConnectionStrings__restaurantdb: `Host=127.0.0.1;Port=${databasePort};Database=${database};Username=${database};Password=${password};SSL Mode=Disable`,
    ConnectionStrings__redis: `127.0.0.1:${redisPort}`,
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development',
    SENTRY_DSN: '',
    JwtSettings__Secret: randomBytes(32).toString('hex'),
    JwtSettings__Issuer: tenantIdentity,
    JwtSettings__Audience: tenantIdentity,
    JwtSettings__TenantSlug: `p11-${runId}`,
    PrinterSettings__ApiKey: printerKey,
    QRCode__SecretKey: qrSecret,
  };
  for (const feature of [
    'ServerWorkspaceV2',
    'TableAccountV1',
    'OrderAmendmentsV1',
    'TableGuestVisitsV1',
    'TableVisitReadinessV1',
    'TableAccountPaymentsV1',
    'TableGuestAccountPaymentsV1',
    'ServerAccountCollectionV1',
  ])
    env[`TenantFeatures__${feature}`] = 'true';
  return env;
}
