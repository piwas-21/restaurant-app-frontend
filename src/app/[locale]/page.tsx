import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { template } from '@active-template';
import { isSupportedPublicLocale } from '@/lib/publicDiscoveryConfig';
import { getPublicHomeData } from '@/services/publicDiscoveryService';
import { homeMetadata, restaurantJsonLd } from '@/lib/publicRouteMetadata';
import type { LanguageCode } from '@/config/languageConfig';

type RouteParams = Promise<{ locale: string }>;
type LocalizedHomeProps = Readonly<{ params: RouteParams }>;

async function routeData(params: RouteParams) {
  const { locale } = await params;
  if (!isSupportedPublicLocale(locale)) notFound();
  return getPublicHomeData(locale);
}

export async function generateMetadata({ params }: LocalizedHomeProps): Promise<Metadata> {
  return homeMetadata(await routeData(params));
}

export default async function LocalizedHome({ params }: LocalizedHomeProps) {
  const data = await routeData(params);
  const jsonLd = restaurantJsonLd(data.restaurantInfo, data.workingHours, data.locale as LanguageCode);
  const HomePage = template.HomePage;
  return (
    <>
      {jsonLd ? <script type="application/ld+json">{jsonLd}</script> : null}
      <HomePage initialData={data} />
    </>
  );
}
