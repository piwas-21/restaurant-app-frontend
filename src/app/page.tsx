import { redirect } from 'next/navigation';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { publicLocaleHref } from '@/lib/publicRouteQuery';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PublicDefaultRoute({ searchParams }: { searchParams: SearchParams }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const entry of Array.isArray(value) ? value : value === undefined ? [] : [value]) query.append(key, entry);
  }
  redirect(publicLocaleHref(TENANT_PUBLIC_CONFIG.defaultLocale, 'home', query));
}
