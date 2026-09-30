import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';

type LocaleLayoutProps = Readonly<{
  children: ReactNode;
  params: Promise<{ locale: string }>;
}>;

/** Validate the physical route segment without adding a second document or provider tree. */
export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!isSupportedPublicLocale(locale)) notFound();
  return children;
}
