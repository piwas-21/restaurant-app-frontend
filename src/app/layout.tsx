// CSS order is load-bearing (screenshot-verified): template tokens first,
// then globals.css (whose legacy aliases read them), then component CSS
// modules pulled in via the template import below — the same effective
// order as when globals.css itself imported the token layer.
import '@active-template/tokens.css';
import './globals.css';
// Tenant UI template (ADR-006): `@active-template` is a build-time alias to
// src/templates/${NEXT_PUBLIC_TEMPLATE} (next.config.ts), so exactly one
// template's chrome/fonts/tokens end up in each tenant image.
import { template } from '@active-template';
import ClientProviders from './client-providers';
import { Metadata, Viewport } from 'next';
import { BRANDING_ICON, RESTAURANT_NAME } from '@/lib/config';
import { getTenantPaletteCss } from '@/services/tenantThemeService';
import { getTenantModules } from '@/services/tenantModulesService';
import ModuleRouteGuard from '@/components/ModuleRouteGuard';

// Tenant branding is baked at build time (issue #125): build-image.yml passes
// RUMI's name, build-tenant-image.yml passes the registry `name` per tenant.
// Baked (not fetched in generateMetadata) so crawlers never see a fallback
// title while an ISR cache warms up after a deploy.
export const metadata: Metadata = {
  title: RESTAURANT_NAME,
  description: `${RESTAURANT_NAME} - Experience authentic flavors.`,
  icons: {
    icon: BRANDING_ICON,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
};

const { Shell, fonts } = template;
const bodyClassName = fonts.map((font) => font.className).join(' ');

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Runtime colour palette (ADR-007): fetched server-side, injected as a
  // hoisted <style> (React 19 lifts it into <head>). The doubled-specificity
  // selectors in paletteToCss win over the baked template tokens regardless of
  // order; an empty string (no/unknown key) renders nothing — the safe default.
  // Product modules this tenant bought (sofra ADR-010 / S11). Read here, server-side,
  // rather than in the browser: a client fetch would let a gated route paint before the
  // answer arrived. Fails OPEN to the full set — see tenantModulesService.
  const [paletteCss, modules] = await Promise.all([getTenantPaletteCss(), getTenantModules()]);
  return (
    // `lang`/`dir` are the SSR DEFAULT, not the answer. The locale is chosen in the browser
    // (`i18n.ts` detects it from localStorage → navigator), so the server cannot know it here;
    // `DocumentLanguage` corrects both attributes on mount and on every switch. Stating `dir`
    // explicitly rather than omitting it means the document always declares a direction, and the
    // client only ever changes a value instead of adding an attribute.
    <html lang="en" dir="ltr" suppressHydrationWarning={true}>
      <body className={bodyClassName}>
        {paletteCss ? (
          <style href="tenant-palette" precedence="high">
            {paletteCss}
          </style>
        ) : null}
        <ClientProviders modules={modules}>
          <Shell>
            <ModuleRouteGuard>{children}</ModuleRouteGuard>
          </Shell>
        </ClientProviders>
      </body>
    </html>
  );
}
