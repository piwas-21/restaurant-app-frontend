import { redirect } from 'next/navigation';
import { TENANT_PUBLIC_CONFIG } from '@/lib/publicDiscoveryConfig';
import { publicLocaleHref, searchParamsToURLSearchParams } from '@/lib/publicRouteQuery';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LegacyMenuRoute({ searchParams }: Readonly<{ searchParams: SearchParams }>) {
  const query = searchParamsToURLSearchParams(await searchParams);
  redirect(publicLocaleHref(TENANT_PUBLIC_CONFIG.defaultLocale, 'menu', query));
}
