import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';

export default async function MyOrdersPage({ params }: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isSupportedPublicLocale(locale)) notFound();
  // Redirect to the new /orders page
  redirect(`/${locale}/orders`);
}
