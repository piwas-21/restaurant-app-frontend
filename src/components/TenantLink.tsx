'use client';

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { tenantLocaleHref } from '@/lib/tenantLocaleNavigation';

type TenantLinkProps = ComponentProps<typeof NextLink>;

/** Localize known same-origin app links from the active route without changing explicit locale targets. */
export default function TenantLink({ href, ...props }: TenantLinkProps) {
  const pathname = usePathname();
  const localizedHref =
    typeof href === 'string' ? tenantLocaleHref(pathname, href) : localizeObjectHref(pathname, href);
  return <NextLink href={localizedHref} {...props} />;
}

function localizeObjectHref(pathname: string | null, href: TenantLinkProps['href']): TenantLinkProps['href'] {
  if (typeof href === 'string' || !href.pathname || !href.pathname.startsWith('/') || href.pathname.startsWith('//')) {
    return href;
  }
  const localized = tenantLocaleHref(pathname, href.pathname);
  const parsed = new URL(localized, 'https://tenant.invalid');
  return { ...href, pathname: parsed.pathname };
}
