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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={bodyClassName}>
        <ClientProviders>
          <Shell>{children}</Shell>
        </ClientProviders>
      </body>
    </html>
  );
}
