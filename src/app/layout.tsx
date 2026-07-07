import { Inter } from 'next/font/google';
import './globals.css';
import AppInternalLayout from './app-internal-layout';
import ClientProviders from './client-providers';
import { Metadata, Viewport } from 'next';
import { RESTAURANT_NAME } from '@/lib/config';

// Tenant branding is baked at build time (issue #125): build-image.yml passes
// RUMI's name, build-tenant-image.yml passes the registry `name` per tenant.
// Baked (not fetched in generateMetadata) so crawlers never see a fallback
// title while an ISR cache warms up after a deploy.
export const metadata: Metadata = {
  title: RESTAURANT_NAME,
  description: `${RESTAURANT_NAME} - Experience authentic flavors.`,
  icons: {
    icon: '/rumi-letter-r-icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
};

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body className={inter.className}>
        <ClientProviders>
          <AppInternalLayout>{children}</AppInternalLayout>
        </ClientProviders>
      </body>
    </html>
  );
}
