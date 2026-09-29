/** Validate operator-supplied build inputs before starting a tenant image build. */
const languages = new Set(['en', 'fr', 'de', 'tr', 'it', 'ar', 'nl', 'es', 'ru', 'zh']);
const defaultLocale = process.env.PUBLIC_DEFAULT_LOCALE;
const indexing = process.env.PUBLIC_INDEXING;
function fail(message) {
  console.error(message);
  process.exit(1);
}
if (!languages.has(defaultLocale)) fail('public_default_locale must be a supported language code');
if (indexing !== 'true' && indexing !== 'false') fail('public_indexing must be true or false');
for (const field of ['PUBLIC_HOME_LOCALES', 'PUBLIC_MENU_LOCALES']) {
  const raw = process.env[field] ?? '';
  const values = raw.split(',');
  if (values.some((value) => !languages.has(value)) || new Set(values).size !== values.length) {
    fail(`${field} must contain unique supported language codes separated by commas`);
  }
  if (!values.includes(defaultLocale)) fail(`${field} must include the public default locale`);
}
const domain = process.env.TENANT_DOMAIN ?? '';
if (
  domain !== domain.trim() ||
  !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(domain)
) {
  fail('tenant_domain must be a hostname without a scheme, path or whitespace');
}
console.log('Public discovery build policy validated');
